<?php

namespace App\Services\WorkLeases;

use App\Models\GlobalTask;
use App\Services\QueueCenter\QueueSliceDiffService;
use App\Models\Worker;
use App\Services\PycoreTasks\PycoreComputeRoster;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\QueueCenter\QueueCenterMetricsService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Carbon;

/**
 * Laravel side of the multi-node work leases (config/queue_center_contract.json
 * work_leases; docs_fix/PROGRESS_20261001_PYCORE_REFACTOR.md J-MULTI).
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
    private const POOLED_KEY = 'work_lease:pooled';
    private const POOLED_CACHE_SECONDS = 30;
    private const WANT_PRIORITY = 100;
    private const PROMOTE_PRIORITY = 1000;
    private const HOUR_SECONDS = 3600;
    private const BUCKET_SECONDS = 60;

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
        $items = [];
        $held = [];

        Worker::touchWorkNode($workerId, $computeClass, $lanes, $seed);
        $renewal = $this->renew($workerId, (array) ($request['lease_ids'] ?? []));
        $this->applyWant($lanes, (array) ($request['want'] ?? []));

        foreach ($this->claimOrder($computeClass, $lanes) as [$lane, $language, $laneMax]) {
            $take = min($budget - count($items), $laneMax - count($held[$lane] ?? []));
            if ($take <= 0) {
                continue;
            }
            foreach ($this->leaseRows($lane, $language, $take, $workerId, $leaseId, $expiresAt) as $item) {
                $items[] = $item;
                $held[$lane][] = $item['row_id'];
            }
            if (count($items) >= $budget) {
                break;
            }
        }
        if ($items !== []) {
            $this->remember($leaseId, $workerId, $items, $expiresAt);
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
            QueueCenterCacheStore::get()->put(self::LEASE_KEY . $leaseId, $lease, $this->registryTtl());
            $result['renewed'][] = ['lease_id' => $leaseId, 'expires_at' => $lease['expires_at']];
        }
        if ($leaseIds !== []) {
            Worker::query()->where('worker_id', $workerId)->update(['last_heartbeat_at' => now(), 'status' => Worker::STATUS_ONLINE]);
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

        return ['released' => $released];
    }

    /** GET work_nodes: every lease node and the per-lane, per-language pool. */
    public function nodes(): array
    {
        $nodes = [];
        $ttl = $this->limit('lease_ttl_seconds');

        foreach (Worker::workNodes() as $worker) {
            $metadata = $worker->metadata;
            $leases = $this->liveNodeLeases((string) $worker->worker_id);
            $itemsLeased = array_sum(array_column($leases, 'items'));
            $donePerHour = $this->itemsPerHour((string) $worker->worker_id, (array) ($metadata['work_throughput_seed'] ?? []));
            $nodes[] = [
                'worker_id' => (string) $worker->worker_id,
                'compute_class' => (string) PycoreComputeRoster::classOf($worker),
                'online' => $this->isOnline($worker, $ttl),
                'lanes' => array_map(static fn (array $lane): array => $lane['languages'], (array) $metadata['work_lanes']),
                'leases' => count($leases),
                'items_leased' => $itemsLeased,
                'done_per_hour' => $donePerHour,
                'batch_size' => $this->batchSize((string) $worker->worker_id, (array) ($metadata['work_throughput_seed'] ?? [])),
                'eta_seconds' => $donePerHour > 0 ? (int) ceil($itemsLeased / $donePerHour * self::HOUR_SECONDS) : null,
                'last_heartbeat_at' => $worker->last_heartbeat_at?->toIso8601String(),
            ];
        }

        return ['nodes' => $nodes, 'pool' => $this->pool()];
    }

    /** Lease reaper (accounting only: a claim already treats expired rows as free). */
    public function reap(): int
    {
        $cleared = 0;

        foreach (WorkLeaseLanes::lanes() as $lane) {
            foreach (WorkLeaseLanes::languages($lane) as $language) {
                $cleared += WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                    ->whereNotNull('tts_lease_id')
                    ->where('tts_lease_expires_at', '<', now())
                    ->update($this->clearedLease());
            }
        }

        return $cleared;
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

    /** @return array<int,array{0:string,1:string,2:int}> [lane, language, lane max] in claim order */
    private function claimOrder(string $computeClass, array $lanes): array
    {
        $order = [];
        $online = $this->onlineNodes();
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

    /** One lease statement on one lane and language. */
    private function leaseRows(string $lane, string $language, int $take, string $workerId, string $leaseId, Carbon $expiresAt): array
    {
        $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
        $now = now();
        $rows = WorkLeaseLanes::connection($lane, $language)->select(
            "UPDATE {$table} SET tts_locked_by = ?, tts_locked_at = ?, tts_lease_id = ?, tts_lease_expires_at = ?"
            . " WHERE id IN (SELECT id FROM {$table} WHERE (" . WorkLeaseLanes::gap($lane) . ') AND ' . WorkLeaseLanes::FREE
            . ' ORDER BY ' . WorkLeaseLanes::rank($lane) . ' LIMIT ? FOR UPDATE SKIP LOCKED)'
            . ' RETURNING id, ' . WorkLeaseLanes::textColumn($lane) . ' AS text, ' . WorkLeaseLanes::keyColumn($lane) . ' AS content_key, tts_priority',
            [$workerId, $now, $leaseId, $expiresAt, $now, $take]
        );
        usort($rows, static fn (object $a, object $b): int => [(int) $b->tts_priority, (int) $a->id] <=> [(int) $a->tts_priority, (int) $b->id]);

        return array_map(static fn (object $row): array => WorkLeaseLanes::item($lane, $language, $row), $rows);
    }

    /** Want entries raise their free gap rows so this claim leases them first. */
    private function applyWant(array $lanes, array $want): void
    {
        $keys = [];

        foreach ($want as $entry) {
            $lane = (string) ($entry['lane'] ?? '');
            $language = (string) ($entry['language'] ?? '');
            if (isset($lanes[$lane]) && in_array($language, $lanes[$lane]['languages'], true)) {
                $keys[$lane . ':' . $language][] = (string) ($entry['content_key'] ?? '');
            }
        }
        foreach ($keys as $pair => $contentKeys) {
            [$lane, $language] = explode(':', $pair, 2);
            WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                ->whereIn(WorkLeaseLanes::keyColumn($lane), array_values(array_unique($contentKeys)))
                ->whereRaw('(' . WorkLeaseLanes::gap($lane) . ')')
                ->where('tts_priority', '<', self::WANT_PRIORITY)
                ->update(['tts_priority' => self::WANT_PRIORITY]);
        }
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
        return QueueCenterCacheStore::get()->remember(self::POOLED_KEY, self::POOLED_CACHE_SECONDS, function (): array {
            return array_values(array_map(
                static fn (array $row): array => ['lane' => $row['lane'], 'language' => $row['language'], 'count' => $row['gap'], 'reason_code' => $row['reason_code']],
                array_filter($this->pool(false), static fn (array $row): bool => $row['reason_code'] !== null)
            ));
        });
    }

    /** Per lane and language with a gap: gap, live-leased, free, reason. */
    private function pool(bool $withLeased = true): array
    {
        $pool = [];
        $online = $this->onlineNodes();
        $noNode = (string) QueueCenterContract::section('work_leases')['reason_codes'][0];

        foreach (WorkLeaseLanes::lanes() as $lane) {
            foreach (WorkLeaseLanes::languages($lane) as $language) {
                $gap = WorkLeaseLanes::gapCount($lane, $language);
                if ($gap <= 0) {
                    continue;
                }
                $leased = $withLeased
                    ? WorkLeaseLanes::connection($lane, $language)->table(WorkLeaseLanes::table($lane, $language))
                        ->whereNotNull('tts_lease_id')
                        ->where('tts_lease_expires_at', '>', now())
                        ->count()
                    : 0;
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
            ->map(static fn (Worker $worker): array => [
                'compute_class' => (string) PycoreComputeRoster::classOf($worker),
                'lanes' => (array) $worker->metadata['work_lanes'],
            ])
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
