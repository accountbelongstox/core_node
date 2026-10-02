<?php

namespace App\Services\WorkLeases;

use App\Models\GlobalTask;
use App\Services\QueueCenter\QueueSliceDiffService;
use App\Models\Worker;
use App\Services\PycoreTasks\PycoreComputeRoster;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\QueueCenter\QueueCenterMetricsService;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Services\QueueCenter\GapLaneSnapshot;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioBundleService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1SentenceQualityRepair;
use App\Support\QueueCenterContract;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Laravel side of the multi-node work leases (config/queue_center_contract.json
 * work_leases; docs_fix/DESIGN_QUEUE_PIPELINE.md).
 *
 * Laravel is the single scheduler. A claim leases a disjoint batch of gap
 * rows in one statement per lane and language
 * (UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING),
 * writing the lease on the row itself (tts_locked_by, tts_lease_id,
 * tts_lease_expires_at). A row whose lease expired is free again, so a
 * vanished node never strands work; results arrive on the content-keyed
 * reports, which clear the lease and close the gap.
 */
final class WorkLeaseService
{
    private const LEASE_KEY = 'work_lease:lease:';
    private const NODE_LEASES_KEY = 'work_lease:node:';
    private const DONE_KEY = 'work_lease:done:';
    private const ONLINE_SET_KEY = 'work_lease:online_nodes';
    private const QUALITY_SWEEP_KEY = 'work_lease:quality_sweep:tick';
    private const QUALITY_SWEEP_SECONDS = 600;
    private const RESURFACE_TICK_KEY = 'work_lease:resurface:tick';
    private const RESURFACE_CURSOR_KEY = 'work_lease:resurface:cursor:';
    private const RESURFACE_COUNT_KEY = 'work_lease:resurface:count:';
    private const EXCLUDE_KEY = 'work_lease:exclude:';
    private const WANT_PRIORITY = 100;
    private const PROMOTE_PRIORITY = 1000;
    private const HOUR_SECONDS = 3600;
    private const BUCKET_SECONDS = 60;
    /** @var array<string,bool> lease indexes found, by connection:index */
    private static array $indexed = [];
    /** @var array<string,bool> scopes already warned about */
    private static array $warned = [];

    /**
     * POST work_lease_claim.
     *
     * @param array{worker_id:string,compute_class:string,throughput_per_hour?:mixed,lanes:array,want?:array,lease_ids?:array} $request
     */
    public function claim(array $request): array
    {
        $workerId = (string) $request['worker_id'];
        $computeClass = (string) $request['compute_class'];
        $lanes = $this->declaredLanes((array) $request['lanes']);
        $seed = $this->throughputSeed($request['throughput_per_hour'] ?? null, array_keys($lanes));
        $ttl = $this->limit('lease_ttl_seconds');
        $expiresAt = now()->addSeconds($ttl);
        $leaseId = bin2hex(random_bytes(16));
        $budget = $this->batchSize($workerId, $seed);
        $rate = $this->itemsPerHour($workerId, $seed);
        $rates = [];
        $items = [];
        $held = [];

        $wasOnline = $this->nodeOnline($workerId);
        Worker::touchWorkNode($workerId, $computeClass, $lanes, $seed, $this->identityOf($request));
        $renewal = $this->renew($workerId, (array) ($request['lease_ids'] ?? []));
        $this->applyWant($workerId, $lanes, (array) ($request['want'] ?? []));
        $online = $this->onlineNodes();
        $fastNode = WorkLeaseFastPass::declaresFast($lanes);
        $assignments = app(WorkLeaseAssignments::class);

        if (($request['plan_id'] ?? '') !== '') {
            app(AppQyV1BookAudioPlanService::class)->hint((string) $request['plan_id']);
        }
        // The app's windows (while its plan heartbeat is fresh) lead; the fast pass and the fair share follow.
        foreach ($assignments->lease($workerId, $lanes, $leaseId, $expiresAt, $budget, []) as $item) {
            $items[] = $item;
            $held[$item['lane']][] = $item['row_id'];
        }
        foreach (app(WorkLeaseFastPass::class)->lease($workerId, $computeClass, $lanes, $leaseId, $expiresAt, $budget - count($items), $assignments) as $item) {
            $items[] = $item;
            $held[$item['lane']][] = $item['row_id'];
        }

        foreach ($this->claimOrder($computeClass, $lanes, $online) as [$lane, $language, $laneMax]) {
            $take = min(
                $budget - count($items),
                $laneMax - count($held[$lane] ?? []),
                $this->fairShare($lane, $language, $workerId, $computeClass, $rate, $online, $rates)
            );
            if ($take <= 0) {
                continue;
            }
            $leaseFastRows = !($fastNode && $lane === WorkLeaseLanes::SENTENCE_AUDIO);
            foreach ($this->leaseRows($lane, $language, $take, $workerId, $leaseId, $expiresAt, $this->excludedKeys($workerId, $lane, $language), $leaseFastRows, $assignments->excludeOthers($workerId, $lane, $language, '"' . WorkLeaseLanes::table($lane, $language) . '"')) as $item) {
                $items[] = $item;
                $held[$lane][] = $item['row_id'];
            }
            if (count($items) >= $budget) {
                break;
            }
        }
        if ($items !== []) {
            $this->remember($leaseId, $workerId, $items, $expiresAt);
            $this->announceLeased($workerId, $items);
        }
        if ($items !== [] || !$wasOnline) {
            $this->signal($items !== [] ? 'claim' : 'node');
        }

        return [
            'lease_id' => $items !== [] ? $leaseId : null,
            'expires_at' => $expiresAt->toIso8601String(),
            'ttl_seconds' => $ttl,
            'items' => $items,
            'renewed' => $renewal['renewed'],
            'lost' => $renewal['lost'],
            'retry_after_seconds' => $items === [] ? $this->limit('empty_retry_after_seconds') : null,
            'progress' => $this->progress(array_keys($lanes)),
            'pooled' => $this->pooled(),
        ];
    }

    /** POST work_lease_renew: extends held leases (a lease without a held row is lost) plus the lane progress. */
    public function renewWithProgress(string $workerId, array $leaseIds): array
    {
        $lanes = array_keys((array) (Worker::findByWorkerId($workerId)?->metadata['work_lanes'] ?? []));

        return $this->renew($workerId, $leaseIds) + ['progress' => $this->progress($lanes)];
    }

    /** Extends held leases; a lease without a held row is lost. */
    public function renew(string $workerId, array $leaseIds): array
    {
        $expiresAt = now()->addSeconds($this->limit('lease_ttl_seconds'));
        $result = ['renewed' => [], 'lost' => []];
        $renewedLanes = [];

        foreach (array_unique(array_map('strval', $leaseIds)) as $leaseId) {
            $lease = QueueCenterCacheStore::get()->get(self::LEASE_KEY . $leaseId);
            $extended = 0;
            if (is_array($lease) && $lease['worker_id'] === $workerId) {
                foreach ($lease['tables'] as $pair) {
                    [$lane, $language] = explode(':', $pair, 2);
                    $extended += WorkLeaseLanes::connection($lane, $language)
                        ->table(WorkLeaseLanes::table($lane, $language))
                        ->where('tts_lease_id', $leaseId)
                        ->where('tts_locked_by', $workerId)
                        ->update(['tts_lease_expires_at' => $expiresAt]);
                }
            }
            if ($extended === 0) {
                $result['lost'][] = $leaseId;
                continue;
            }
            $lease['expires_at'] = $expiresAt->toIso8601String();
            foreach ($lease['tables'] as $pair) {
                [$lane, $language] = explode(':', $pair, 2);
                $renewedLanes[$lane][] = $language;
            }
            QueueCenterCacheStore::get()->put(self::LEASE_KEY . $leaseId, $lease, $this->registryTtl());
            $result['renewed'][] = ['lease_id' => $leaseId, 'expires_at' => $lease['expires_at']];
        }
        if ($leaseIds !== []) {
            Worker::touchWorkLanes($workerId, $renewedLanes);
            $this->signal('renew');
        }

        return $result;
    }

    /**
     * POST work_lease_release: frees one lease, some rows of the worker's
     * leases, or (no lease_id, no rows) every lease of the worker on its
     * declared lanes (node start/stop).
     */
    public function release(string $workerId, ?string $leaseId, array $rows): array
    {
        $released = 0;
        $leaseIds = $leaseId !== null ? [$leaseId] : $this->nodeLeaseIds($workerId);
        $rowIds = [];

        foreach ($rows as $row) {
            $rowIds[(string) ($row['lane'] ?? '')][] = (int) ($row['row_id'] ?? 0);
        }
        foreach ($leaseIds as $id) {
            $lease = QueueCenterCacheStore::get()->get(self::LEASE_KEY . $id);
            if (!is_array($lease) || $lease['worker_id'] !== $workerId) {
                continue;
            }
            foreach ($lease['tables'] as $pair) {
                [$lane, $language] = explode(':', $pair, 2);
                if ($rows !== [] && !isset($rowIds[$lane])) {
                    continue;
                }
                $query = WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                    ->where('tts_lease_id', $id)
                    ->where('tts_locked_by', $workerId);
                if ($rows !== []) {
                    $query->whereIn('id', $rowIds[$lane]);
                }
                $released += $query->update($this->clearedLease());
            }
            if ($rows === []) {
                QueueCenterCacheStore::get()->forget(self::LEASE_KEY . $id);
            }
        }
        if ($leaseId === null && $rows === []) {
            $released += $this->releaseDeclared($workerId);
            QueueCenterCacheStore::get()->forget(self::NODE_LEASES_KEY . $workerId);
        }
        if ($released > 0) {
            $this->signal('release');
        }

        return ['released' => $released];
    }

    /** GET work_nodes: every lease node and the per-lane, per-language pool. */
    public function nodes(bool $onlineOnly = false): array
    {
        $nodes = [];
        $ttl = $this->limit('lease_ttl_seconds');

        foreach (Worker::workNodes() as $worker) {
            $metadata = $worker->metadata;
            if ($onlineOnly && !$this->isOnline($worker, $ttl)) {
                continue;
            }
            $lanes = $worker->liveWorkLanes($ttl);
            $leases = $this->liveNodeLeases((string) $worker->worker_id);
            $itemsLeased = array_sum(array_column($leases, 'items'));
            $donePerHour = $this->itemsPerHour((string) $worker->worker_id, (array) ($metadata['work_throughput_seed'] ?? []));
            $nodes[] = [
                'worker_id' => (string) $worker->worker_id,
                'sid' => $this->shortId((string) $worker->worker_id),
                'platform' => (string) ($metadata['work_identity']['platform'] ?? ''),
                'label' => (string) ($metadata['work_identity']['label'] ?? ''),
                'compute_class' => PycoreComputeRoster::publicClass(PycoreComputeRoster::classOf($worker)),
                'online' => $this->isOnline($worker, $ttl),
                'lanes' => array_map(static fn (array $lane): array => (array) ($lane['languages'] ?? []), $lanes),
                'engines' => array_map(static fn (array $lane): array => (array) ($lane['engines'] ?? []), $lanes),
                'leases' => count($leases),
                'items_leased' => $itemsLeased,
                'done_per_hour' => $donePerHour,
                'batch_size' => $this->batchSize((string) $worker->worker_id, (array) ($metadata['work_throughput_seed'] ?? [])),
                'eta_seconds' => $donePerHour > 0 ? (int) ceil($itemsLeased / $donePerHour * self::HOUR_SECONDS) : null,
                'last_heartbeat_at' => $worker->last_heartbeat_at?->toIso8601String(),
            ];
        }

        return [
            'revision' => app(QueueCenterRealtimeService::class)->workNodesRevision(),
            'nodes' => $nodes,
            'pool' => $onlineOnly ? [] : $this->pool(),
        ];
    }

    /** Stable short node id (work_leases.sid_length hex chars of the worker id hash): the id clip.leased carries. */
    public function shortId(string $workerId): string
    {
        return substr(hash('sha1', $workerId), 0, $this->limit('sid_length'));
    }

    /** Identity fields a claim carries (platform, host label), trimmed; absent fields stay absent. */
    private function identityOf(array $request): array
    {
        $identity = [];

        foreach (['platform', 'label'] as $field) {
            $value = trim((string) ($request[$field] ?? ''));
            if ($value !== '') {
                $identity[$field] = $value;
            }
        }

        return $identity;
    }

    /**
     * clip.leased: resource ids of the leased rows somebody asked for (priority
     * at or above the want level: a wordnew promotion or want entry) with the
     * node's short id; plain backlog rows are not announced.
     */
    private function announceLeased(string $workerId, array $items): void
    {
        $ids = [];

        foreach ($items as $item) {
            if ((int) $item['priority'] < self::WANT_PRIORITY) {
                continue;
            }
            $isWord = $item['lane'] === WorkLeaseLanes::WORD_AUDIO;
            $ids[] = AppQyV1AudioBundleService::resourceKey(
                $isWord ? AppQyV1AudioBundleService::KIND_WORD : AppQyV1AudioBundleService::KIND_SENTENCE,
                (string) $item['language'],
                $isWord ? mb_strtolower(trim((string) $item['text'])) : (string) $item['content_id']
            );
        }
        if ($ids !== []) {
            app(QueueCenterRealtimeService::class)->publishClipLeased($this->shortId($workerId), $ids);
        }
    }

    /**
     * Gap rows under a live lease per language of one lane (languages with a gap only).
     *
     * @return array<string,int>
     */
    public function leasedByLanguage(string $lane): array
    {
        return array_map(
            static fn (array $figures): int => $figures['leased'],
            array_filter(GapLaneSnapshot::lane($lane), static fn (array $figures): bool => $figures['gap'] > 0)
        );
    }

    /**
     * Lease reaper (accounting only: a claim already treats expired rows as
     * free). A language whose table lacks the lease columns or the lease
     * expiry index (sys:init has not aligned it) is skipped with one warning,
     * never scanned sequentially.
     */
    public function reap(): int
    {
        $cleared = 0;
        $db = null;
        $table = '';
        $index = '';

        foreach (WorkLeaseLanes::lanes() as $lane) {
            foreach (WorkLeaseLanes::languages($lane) as $language) {
                $db = WorkLeaseLanes::connection($lane, $language);
                $table = WorkLeaseLanes::table($lane, $language);
                $index = AppQyV1MediaGaps::leaseExpiryIndex($lane === WorkLeaseLanes::WORD_AUDIO, $language);
                try {
                    if (!$this->hasIndex($db, $table, $index)) {
                        $this->warnOnce('reap:' . $lane . ':' . $language, '[WorkLease] lease reaper skipped language: index missing', ['lane' => $lane, 'language' => $language, 'index' => $index]);
                        continue;
                    }
                    $cleared += $db->table($table)
                        ->whereNotNull('tts_lease_id')
                        ->where('tts_lease_expires_at', '<', now())
                        ->update($this->clearedLease());
                } catch (QueryException $e) {
                    // A table sys:init has not aligned yet (lease columns missing) skips the language.
                    $this->warnOnce('reap:' . $lane . ':' . $language, '[WorkLease] lease reaper skipped language', ['lane' => $lane, 'language' => $language, 'error' => $e->getMessage()]);
                    continue;
                }
            }
        }
        if ($cleared > 0) {
            $this->signal('expiry');
        }
        // Sentence quality floor: audio from a provider below it returns to the pool (every QUALITY_SWEEP_SECONDS).
        if (QueueCenterCacheStore::get()->add(self::QUALITY_SWEEP_KEY, 1, self::QUALITY_SWEEP_SECONDS)) {
            (new AppQyV1SentenceQualityRepair())->run();
        }
        if ($this->onlineSetChanged()) {
            $this->signal('node');
        }

        return $cleared;
    }

    /**
     * Failed resurfacing: per lane and language, at most work_leases.resurface_batch
     * failed rows still in the gap (WorkLeaseLanes::resurfaceable) go back to the
     * pool with a fresh retry budget, at most once per resurface_interval_seconds.
     * A persisted id cursor wraps at the end of the table, so each row is retried
     * at most once per sweep and an outage never hot-loops at the claim head.
     *
     * @return array<int,array{lane:string,language:string,resurfaced:int}> sweeps finished this tick
     */
    public function resurface(): array
    {
        $batch = $this->limit('resurface_batch');
        $cache = QueueCenterCacheStore::get();
        $finished = [];
        $resurfaced = 0;

        if ($batch <= 0 || !$cache->add(self::RESURFACE_TICK_KEY, 1, $this->limit('resurface_interval_seconds'))) {
            return [];
        }
        foreach (WorkLeaseLanes::lanes() as $lane) {
            foreach (WorkLeaseLanes::languages($lane) as $language) {
                $scope = $lane . ':' . $language;
                $afterId = max(0, (int) $cache->get(self::RESURFACE_CURSOR_KEY . $scope, 0));
                $table = WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language));
                try {
                    $ids = (clone $table)->whereRaw(WorkLeaseLanes::resurfaceable($lane))
                        ->where('id', '>', $afterId)
                        ->orderBy('id')
                        ->limit($batch)
                        ->pluck('id')
                        ->map(static fn ($id): int => (int) $id)
                        ->all();
                } catch (QueryException $e) {
                    // A table sys:init has not aligned yet (gap columns missing) skips the language.
                    Log::warning('[WorkLease] failed resurfacing skipped language', ['lane' => $lane, 'language' => $language, 'error' => $e->getMessage()]);
                    continue;
                }
                if ($ids === []) {
                    $swept = (int) $cache->pull(self::RESURFACE_COUNT_KEY . $scope, 0);
                    if ($afterId > 0) {
                        $cache->forever(self::RESURFACE_CURSOR_KEY . $scope, 0);
                        $finished[] = ['lane' => $lane, 'language' => $language, 'resurfaced' => $swept];
                    }
                    continue;
                }
                $rows = $table->whereIn('id', $ids)
                    ->whereRaw(WorkLeaseLanes::resurfaceable($lane))
                    ->update(['tts_status' => 'pending', 'tts_attempts' => 0, 'tts_error' => null] + self::clearedLease());
                $cache->forever(self::RESURFACE_CURSOR_KEY . $scope, end($ids));
                $cache->forever(self::RESURFACE_COUNT_KEY . $scope, (int) $cache->get(self::RESURFACE_COUNT_KEY . $scope, 0) + $rows);
                $resurfaced += $rows;
            }
        }
        if ($resurfaced > 0) {
            $this->signal('pool');
        }

        return $finished;
    }

    /**
     * Raises one gap row to the front of its lane (wordnew promotion: the
     * retired queue-head ticket). The caller emits the {queue}_head event that
     * wakes the nodes into an urgent claim.
     */
    public function promote(string $lane, string $language, string $contentKey): bool
    {
        $raised = WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
            ->where(WorkLeaseLanes::keyColumn($lane), $contentKey)
            ->whereRaw('(' . WorkLeaseLanes::gap($lane) . ')')
            ->update(['tts_priority' => self::PROMOTE_PRIORITY, 'tts_requested_at' => now()]);
        return $raised > 0;
    }

    /** Called by the content-keyed reports on a delivered item. */
    public static function noteCompletion(string $workerId): void
    {
        if ($workerId === '') {
            return;
        }
        $key = self::DONE_KEY . $workerId . ':' . intdiv(time(), self::BUCKET_SECONDS);
        QueueCenterCacheStore::get()->add($key, 0, self::HOUR_SECONDS * 2);
        QueueCenterCacheStore::get()->increment($key);
        // A delivered item changes the pool counts of the multi-node panel.
        app(QueueCenterRealtimeService::class)->publishWorkNodes('pool');
    }

    /**
     * A failure carrying a contract repool code is a node capability miss
     * (work_leases.repool_error_codes): the row returns to the pool instead of failing.
     */
    public static function isRepoolError(?string $error): bool
    {
        foreach ((array) (QueueCenterContract::section('work_leases')['repool_error_codes'] ?? []) as $code) {
            if ($error !== null && $code !== '' && str_contains($error, (string) $code)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns rows that failed with a repool code to the pool (sys:init repair
     * of failures recorded before the rule).
     *
     * @return array<string,int> lane => rows re-pooled
     */
    public function repoolCapabilityFailures(): array
    {
        $repooled = [];

        foreach (WorkLeaseLanes::lanes() as $lane) {
            $repooled[$lane] = 0;
            foreach (WorkLeaseLanes::languages($lane) as $language) {
                $query = WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                    ->where('tts_status', 'failed')
                    ->where(function ($codes): void {
                        foreach ((array) QueueCenterContract::section('work_leases')['repool_error_codes'] as $code) {
                            $codes->orWhere('tts_error', 'like', '%' . $code . '%');
                        }
                    });
                $repooled[$lane] += $query->update(['tts_status' => 'pending', 'tts_attempts' => 0, 'tts_error' => null] + self::clearedLease());
            }
        }

        return $repooled;
    }

    /**
     * sys:init: cancels the pending word/sentence gap-row tickets left from the
     * retired task path (their rows stay in the gap, now claimable as leases).
     */
    public function retireGapTickets(): int
    {
        $cancelled = GlobalTask::cancelPendingGapTickets(WorkLeaseLanes::lanes());
        foreach (WorkLeaseLanes::lanes() as $lane) {
            app(QueueSliceDiffService::class)->markChanged($lane);
        }

        return $cancelled;
    }

    /** Lease columns a delivery or a release resets. */
    public static function clearedLease(): array
    {
        return ['tts_lease_id' => null, 'tts_lease_expires_at' => null, 'tts_locked_by' => null, 'tts_locked_at' => null];
    }

    /**
     * The gap progress (contract progress_template) of each lane: the only
     * progress feed of these lanes now that their task diff is retired.
     *
     * @return array<string,array>
     */
    /** Whether $index exists on $table (a found index is remembered for the process). */
    private function hasIndex(ConnectionInterface $db, string $table, string $index): bool
    {
        $key = $db->getName() . ':' . $index;

        if (isset(self::$indexed[$key])) {
            return true;
        }
        if ($db->selectOne(
            'SELECT 1 AS found FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = to_regclass(?) AND c.relname = ?',
            ['"' . str_replace('"', '""', $table) . '"', $index]
        ) === null) {
            return false;
        }
        self::$indexed[$key] = true;

        return true;
    }

    /** One warning per scope and process (a skipped language must not flood the log every tick). */
    private function warnOnce(string $scope, string $message, array $context): void
    {
        if (isset(self::$warned[$scope])) {
            return;
        }
        self::$warned[$scope] = true;
        Log::warning($message, $context);
    }

    private function progress(array $lanes): array
    {
        $progress = [];

        foreach ($lanes as $lane) {
            if (WorkLeaseLanes::isLane((string) $lane)) {
                $progress[$lane] = app(QueueCenterMetricsService::class)->progress((string) $lane);
            }
        }

        return $progress;
    }

    /** Throttled work_nodes.changed (contract work_leases.nodes_event). */
    private function signal(string $reason): void
    {
        app(QueueCenterRealtimeService::class)->publishWorkNodes($reason);
    }

    private function nodeOnline(string $workerId): bool
    {
        $worker = Worker::findByWorkerId($workerId);

        return $worker !== null && $this->isOnline($worker, $this->limit('lease_ttl_seconds'));
    }

    /** True when the set of online lease nodes differs from the reaper's last look. */
    private function onlineSetChanged(): bool
    {
        $ttl = $this->limit('lease_ttl_seconds');
        $online = Worker::workNodes()
            ->filter(fn (Worker $worker): bool => $this->isOnline($worker, $ttl))
            ->pluck('worker_id')
            ->sort()
            ->values()
            ->all();
        $previous = QueueCenterCacheStore::get()->get(self::ONLINE_SET_KEY);
        QueueCenterCacheStore::get()->put(self::ONLINE_SET_KEY, $online, self::HOUR_SECONDS);

        return $previous !== null && $previous !== $online;
    }

    /** @return array<int,array{0:string,1:string,2:int}> [lane, language, lane max] in claim order */
    private function claimOrder(string $computeClass, array $lanes, array $online): array
    {
        $order = [];
        $laneNames = array_keys($lanes);

        // A gpu node serves its gpu_preferred lanes first, a cpu node its cpu_ok lanes.
        usort($laneNames, function (string $a, string $b) use ($computeClass): int {
            $prefersGpu = static fn (string $lane): bool => QueueCenterContract::taskTypeCompute($lane) !== QueueCenterContract::COMPUTE_CPU_OK;

            return $computeClass === PycoreComputeRoster::CLASS_GPU
                ? (int) $prefersGpu($b) <=> (int) $prefersGpu($a)
                : (int) $prefersGpu($a) <=> (int) $prefersGpu($b);
        });
        foreach ($laneNames as $lane) {
            $compute = QueueCenterContract::taskTypeCompute($lane);
            if ($computeClass !== PycoreComputeRoster::CLASS_GPU && $compute === QueueCenterContract::COMPUTE_GPU_REQUIRED) {
                continue;
            }
            foreach ($lanes[$lane]['languages'] as $language) {
                if ($computeClass !== PycoreComputeRoster::CLASS_GPU
                    && $compute === QueueCenterContract::COMPUTE_GPU_PREFERRED
                    && $this->gpuNodeServes($online, $lane, $language)) {
                    continue;
                }
                $order[] = [$lane, $language, $lanes[$lane]['max_items']];
            }
        }

        return $order;
    }

    /**
     * Rate-weighted share of one lane+language's free rows this node may take
     * now, so a fast node never swallows a backlog other online nodes serve
     * (no node starves). Unbounded while no other eligible node serves it. A
     * gpu node on a cpu_ok lane counts work_leases.gpu_cpu_lane_weight of its
     * rate while a gpu_preferred lane it serves still has free rows (gpu nodes
     * prefer sentences, cpu nodes carry the words).
     *
     * @param array<string,float> $rates per-request memo of node rates
     */
    private function fairShare(string $lane, string $language, string $workerId, string $computeClass, int $rate, array $online, array &$rates): int
    {
        $figures = GapLaneSnapshot::language($lane, $language);
        $free = max(0, $figures['gap'] - $figures['leased']);
        $mine = $this->laneWeight($computeClass, $lane, (float) $rate, $online[$workerId] ?? null);
        $others = 0.0;
        $gpuPreferred = QueueCenterContract::taskTypeCompute($lane) === QueueCenterContract::COMPUTE_GPU_PREFERRED;

        foreach ($online as $id => $node) {
            $id = (string) $id;
            if ($id === $workerId || !in_array($language, (array) ($node['lanes'][$lane]['languages'] ?? []), true)) {
                continue;
            }
            // A cpu node does not compete for a gpu_preferred lane a gpu node serves (claimOrder holds it back).
            if ($gpuPreferred && $computeClass === PycoreComputeRoster::CLASS_GPU && $node['compute_class'] !== PycoreComputeRoster::CLASS_GPU) {
                continue;
            }
            $rates[$id] ??= (float) $this->itemsPerHour($id, $node['seed']);
            $others += $this->laneWeight($node['compute_class'], $lane, $rates[$id], $node);
        }
        if ($others <= 0.0) {
            return PHP_INT_MAX;
        }

        return max(1, (int) ceil($free * $mine / ($mine + $others)));
    }

    /** A node's rate on one lane (fairShare: the gpu discount on cpu_ok lanes). */
    private function laneWeight(string $computeClass, string $lane, float $rate, ?array $node): float
    {
        $weight = max(1.0, $rate);

        if ($computeClass === PycoreComputeRoster::CLASS_GPU
            && QueueCenterContract::taskTypeCompute($lane) === QueueCenterContract::COMPUTE_CPU_OK
            && $node !== null && $this->hasGpuWork($node)) {
            $weight *= (float) $this->setting('gpu_cpu_lane_weight');
        }

        return $weight;
    }

    /** Whether a gpu_preferred lane the node serves still has free rows in one of its languages. */
    private function hasGpuWork(array $node): bool
    {
        foreach ((array) $node['lanes'] as $lane => $spec) {
            if (QueueCenterContract::taskTypeCompute((string) $lane) !== QueueCenterContract::COMPUTE_GPU_PREFERRED) {
                continue;
            }
            foreach ((array) ($spec['languages'] ?? []) as $language) {
                $figures = GapLaneSnapshot::language((string) $lane, (string) $language);
                if ($figures['gap'] - $figures['leased'] > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /** One lease statement on one lane and language. */
    private function leaseRows(string $lane, string $language, int $take, string $workerId, string $leaseId, Carbon $expiresAt, array $excluded = [], bool $withFastRows = true, string $assigned = ''): array
    {
        $notExcluded = $excluded === [] ? '' : ' AND ' . WorkLeaseLanes::keyColumn($lane) . ' NOT IN (' . implode(',', array_fill(0, count($excluded), '?')) . ')';
        $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
        $now = now();
        // A node that declares the fast engine leases the fast-pass plans' rows through WorkLeaseFastPass, never here.
        $notFast = $withFastRows ? '' : app(WorkLeaseFastPass::class)->excludeFastRows(WorkLeaseLanes::table($lane, $language));
        $rows = WorkLeaseLanes::connection($lane, $language)->select(
            "UPDATE {$table} SET tts_locked_by = ?, tts_locked_at = ?, tts_lease_id = ?, tts_lease_expires_at = ?"
            . " WHERE id IN (SELECT id FROM {$table} WHERE (" . WorkLeaseLanes::gap($lane) . ') AND ' . WorkLeaseLanes::FREE
            . $notExcluded . $notFast . $assigned . ' ORDER BY ' . WorkLeaseLanes::rank($lane) . ' LIMIT ? FOR UPDATE SKIP LOCKED)'
            . ' RETURNING id, ' . WorkLeaseLanes::textColumn($lane) . ' AS text, ' . WorkLeaseLanes::keyColumn($lane) . ' AS content_key, tts_priority',
            array_merge([$workerId, $now, $leaseId, $expiresAt, $now], $excluded, $withFastRows ? [] : [$language], [$take])
        );
        usort($rows, static fn (object $a, object $b): int => [(int) $b->tts_priority, (int) $a->id] <=> [(int) $a->tts_priority, (int) $b->id]);

        return array_map(static fn (object $row): array => WorkLeaseLanes::item($lane, $language, $row), $rows);
    }

    /**
     * Want entries are the node's local generation list (its orchestration /
     * manual queue): their free gap rows are raised so the OTHER online nodes
     * lease them first, and they are excluded from this node's own claims
     * (work_leases.exclude_*), so the node works its list locally while the
     * rest work the same list from Laravel without overlap. A sentence entry
     * carries its content_id, a word entry its text (Laravel owns the md5).
     */
    private function applyWant(string $workerId, array $lanes, array $want): void
    {
        $keys = [];

        foreach ($want as $entry) {
            $lane = (string) ($entry['lane'] ?? '');
            $language = (string) ($entry['language'] ?? '');
            $key = $this->wantKey($lane, $entry);
            if ($key !== '' && isset($lanes[$lane]) && in_array($language, $lanes[$lane]['languages'], true)) {
                $keys[$lane . ':' . $language][] = $key;
            }
        }
        foreach ($keys as $pair => $contentKeys) {
            [$lane, $language] = explode(':', $pair, 2);
            $contentKeys = array_values(array_unique($contentKeys));
            WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                ->whereIn(WorkLeaseLanes::keyColumn($lane), $contentKeys)
                ->whereRaw('(' . WorkLeaseLanes::gap($lane) . ')')
                ->where('tts_priority', '<', self::WANT_PRIORITY)
                ->update(['tts_priority' => self::WANT_PRIORITY]);
            $this->exclude($workerId, $lane, $language, $contentKeys);
        }
    }

    private function wantKey(string $lane, array $entry): string
    {
        $key = trim((string) ($entry['content_key'] ?? ''));

        if ($key === '' && $lane === WorkLeaseLanes::WORD_AUDIO && trim((string) ($entry['text'] ?? '')) !== '') {
            return AppQyV1LangDictionaryModel::wordMd5(trim((string) $entry['text']));
        }

        return $key;
    }

    /** Adds keys to the node's exclusion list (newest exclude_max kept, refreshed for exclude_ttl_seconds). */
    private function exclude(string $workerId, string $lane, string $language, array $keys): void
    {
        $cache = QueueCenterCacheStore::get();
        $key = self::EXCLUDE_KEY . $workerId . ':' . $lane . ':' . $language;
        $merged = array_values(array_unique(array_merge($this->excludedKeys($workerId, $lane, $language), $keys)));

        $cache->put($key, array_slice($merged, -$this->limit('exclude_max')), $this->limit('exclude_ttl_seconds'));
    }

    /** @return array<int,string> content keys this node must not lease (its own local list) */
    private function excludedKeys(string $workerId, string $lane, string $language): array
    {
        return array_map('strval', (array) QueueCenterCacheStore::get()->get(self::EXCLUDE_KEY . $workerId . ':' . $lane . ':' . $language, []));
    }

    /** The request's lanes reduced to lease lanes and the languages each can serve. */
    private function declaredLanes(array $lanes): array
    {
        $declared = [];

        foreach ($lanes as $lane => $spec) {
            if (!WorkLeaseLanes::isLane((string) $lane) || !is_array($spec)) {
                continue;
            }
            $languages = array_values(array_intersect(
                array_map(static fn ($language): string => strtolower((string) $language), (array) ($spec['languages'] ?? [])),
                WorkLeaseLanes::languages((string) $lane)
            ));
            $declared[(string) $lane] = [
                'languages' => $languages,
                'engines' => array_values(array_map('strval', (array) ($spec['engines'] ?? []))),
                'max_items' => max(0, (int) ($spec['max_items'] ?? $this->limit('batch_max'))),
            ];
        }

        return $declared;
    }

    /** @return array<string,int> lane => node-measured items per hour */
    private function throughputSeed(mixed $seed, array $lanes): array
    {
        if (is_array($seed)) {
            return array_map('intval', array_intersect_key($seed, array_flip($lanes)));
        }

        return is_numeric($seed) ? [(string) ($lanes[0] ?? '') => (int) $seed] : [];
    }

    /** clamp(items/h × ttl/h × batch_ttl_fraction, batch_min, batch_max). */
    private function batchSize(string $workerId, array $seed): int
    {
        $perHour = $this->itemsPerHour($workerId, $seed);
        $size = (int) floor($perHour * $this->limit('lease_ttl_seconds') / self::HOUR_SECONDS * (float) $this->setting('batch_ttl_fraction'));

        return max($this->limit('batch_min'), min($this->limit('batch_max'), $size));
    }

    /**
     * items/h = max(measured, the node's declared capacity). measured =
     * completions in throughput_window_seconds / max(throughput_min_span_seconds,
     * now - oldest completion in the window) x 3600, from one-minute buckets
     * (0 below batch_min completions). The declared capacity always counts: a
     * measured rate is capped by the work a node was given, so on its own it
     * would hold a node at a small batch.
     */
    private function itemsPerHour(string $workerId, array $seed): int
    {
        $now = time();
        $window = $this->limit('throughput_window_seconds');
        $first = intdiv($now - $window, self::BUCKET_SECONDS) + 1;
        $last = intdiv($now, self::BUCKET_SECONDS);
        $keys = [];
        $done = 0;
        $oldest = null;

        for ($bucket = $first; $bucket <= $last; $bucket++) {
            $keys[$bucket] = self::DONE_KEY . $workerId . ':' . $bucket;
        }
        $counts = QueueCenterCacheStore::get()->many(array_values($keys));
        foreach ($keys as $bucket => $key) {
            $count = (int) ($counts[$key] ?? 0);
            if ($count > 0) {
                $oldest ??= $bucket * self::BUCKET_SECONDS;
                $done += $count;
            }
        }
        $measured = ($done < $this->limit('batch_min') || $oldest === null)
            ? 0
            : (int) round($done / max($this->limit('throughput_min_span_seconds'), $now - $oldest) * self::HOUR_SECONDS);

        return max($measured, array_sum($seed));
    }

    private function remember(string $leaseId, string $workerId, array $items, Carbon $expiresAt): void
    {
        $tables = [];
        $nodeLeases = $this->nodeLeaseIds($workerId);

        foreach ($items as $item) {
            $tables[$item['lane'] . ':' . $item['language']] = true;
        }
        QueueCenterCacheStore::get()->put(self::LEASE_KEY . $leaseId, [
            'worker_id' => $workerId,
            'tables' => array_keys($tables),
            'items' => count($items),
            'expires_at' => $expiresAt->toIso8601String(),
        ], $this->registryTtl());
        $nodeLeases[] = $leaseId;
        QueueCenterCacheStore::get()->put(self::NODE_LEASES_KEY . $workerId, array_values(array_unique($nodeLeases)), $this->registryTtl());
    }

    /** @return array<int,string> */
    private function nodeLeaseIds(string $workerId): array
    {
        return (array) QueueCenterCacheStore::get()->get(self::NODE_LEASES_KEY . $workerId, []);
    }

    /** @return array<int,array{items:int}> live leases of one node */
    private function liveNodeLeases(string $workerId): array
    {
        $leases = [];

        foreach ($this->nodeLeaseIds($workerId) as $leaseId) {
            $lease = QueueCenterCacheStore::get()->get(self::LEASE_KEY . $leaseId);
            if (is_array($lease) && Carbon::parse($lease['expires_at'])->isFuture()) {
                $leases[] = $lease;
            }
        }

        return $leases;
    }

    /** Fallback for a node whose lease registry is gone: its rows on every declared lane. */
    private function releaseDeclared(string $workerId): int
    {
        $released = 0;
        $worker = Worker::findByWorkerId($workerId);

        foreach ((array) ($worker?->metadata['work_lanes'] ?? []) as $lane => $spec) {
            foreach ((array) ($spec['languages'] ?? []) as $language) {
                $released += WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                    ->whereNotNull('tts_lease_id')
                    ->where('tts_locked_by', $workerId)
                    ->update($this->clearedLease());
            }
        }

        return $released;
    }

    /** Lanes and languages with a gap no online node declares (NO_CAPABLE_NODE). */
    private function pooled(): array
    {
        return array_values(array_map(
            static fn (array $row): array => ['lane' => $row['lane'], 'language' => $row['language'], 'count' => $row['gap'], 'reason_code' => $row['reason_code']],
            array_filter($this->pool(), static fn (array $row): bool => $row['reason_code'] !== null)
        ));
    }

    /** Per lane and language with a gap: gap, live-leased, free, reason (from the lane snapshots; no table read). */
    private function pool(): array
    {
        $pool = [];
        $online = $this->onlineNodes();
        $noNode = (string) QueueCenterContract::section('work_leases')['reason_codes'][0];

        foreach (WorkLeaseLanes::lanes() as $lane) {
            foreach (GapLaneSnapshot::lane($lane) as $language => $figures) {
                $gap = $figures['gap'];
                $leased = $figures['leased'];
                if ($gap <= 0) {
                    continue;
                }
                $language = (string) $language;
                $pool[] = [
                    'lane' => $lane,
                    'language' => $language,
                    'gap' => $gap,
                    'leased' => $leased,
                    'free' => max(0, $gap - $leased),
                    'reason_code' => $this->anyNodeServes($online, $lane, $language) ? null : $noNode,
                ];
            }
        }

        return $pool;
    }

    private function onlineNodes(): array
    {
        $ttl = $this->limit('lease_ttl_seconds');

        return Worker::workNodes()
            ->filter(fn (Worker $worker): bool => $this->isOnline($worker, $ttl))
            ->mapWithKeys(static fn (Worker $worker): array => [(string) $worker->worker_id => [
                'compute_class' => (string) PycoreComputeRoster::classOf($worker),
                'lanes' => $worker->liveWorkLanes($ttl),
                'seed' => (array) ($worker->metadata['work_throughput_seed'] ?? []),
            ]])
            ->all();
    }

    private function gpuNodeServes(array $online, string $lane, string $language): bool
    {
        foreach ($online as $node) {
            if ($node['compute_class'] === PycoreComputeRoster::CLASS_GPU && in_array($language, (array) ($node['lanes'][$lane]['languages'] ?? []), true)) {
                return true;
            }
        }

        return false;
    }

    private function anyNodeServes(array $online, string $lane, string $language): bool
    {
        foreach ($online as $node) {
            if (in_array($language, (array) ($node['lanes'][$lane]['languages'] ?? []), true)) {
                return true;
            }
        }

        return false;
    }

    private function isOnline(Worker $worker, int $ttl): bool
    {
        return $worker->last_heartbeat_at !== null && $worker->last_heartbeat_at->gt(now()->subSeconds($ttl));
    }

    private function registryTtl(): int
    {
        return $this->limit('lease_ttl_seconds') * 2;
    }

    private function limit(string $name): int
    {
        return (int) $this->setting($name);
    }

    private function setting(string $name): mixed
    {
        return QueueCenterContract::section('work_leases')[$name];
    }
}
