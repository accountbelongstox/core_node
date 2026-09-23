<?php

namespace App\Services\QueueCenter\DictLane;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Models\GlobalTask;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\QueueCenter\QueueCenterService;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Log;

/**
 * Dict-lane queue center — the timer-free cached queue bottom layer
 * (docs_fix/DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md).
 *
 * The backend no longer MAINTAINS these queues: each lane is a live view over
 * its dictionary source query (DictLaneCatalog), cached in this long-lived
 * worker's memory. Every serve first runs the ms-level table probe
 * (DictLaneTableProbe — table length + write counters); unchanged signatures
 * serve the cached queue with ZERO database reads, a changed signature
 * re-fetches only the lane's lite id list and minimally diffs it against the
 * cached list.
 *
 * Memory-first, restart-safe: the lane cache lives in process statics and is
 * mirrored to the database cache store as a JSON snapshot (debounced), so a
 * worker restart restores without a mass re-query and a stale snapshot is
 * corrected by the next probe.
 *
 * Just-in-time materialization: global_tasks rows for a dict lane exist ONLY
 * for pages a worker actually claimed (ensureMaterialized, called from the
 * typed worker pull). Payloads are byte-identical to the retired producers',
 * so claim/result/write-back and the UI drilldown are untouched.
 */
final class DictLaneQueueCenter
{
    private const SNAPSHOT_PREFIX = 'dict_lane:snapshot:v1:';
    private const DIRTY_PREFIX = 'dict_lane:dirty:v1:';
    private const SNAPSHOT_SAVE_INTERVAL_SECONDS = 60;
    /** Inflight entries older than this are re-served (failed/dead tasks). */
    private const INFLIGHT_TTL_SECONDS = 900;

    /** @var array<string,array<string,array{signature:string,rows:array<int,array>,saved_at:int}>> */
    private static array $laneCache = [];

    /** @var array<string,int> lane+lang => unix time of the last snapshot write. */
    private static array $snapshotSavedAt = [];

    /** @var array<string,array<int,int>> lane+lang => row id => inflight since (unix). */
    private static array $inflight = [];

    private TaskManagerService $taskManager;
    private QueueCenterService $queueCenter;

    public function __construct(
        ?TaskManagerService $taskManager = null,
        ?QueueCenterService $queueCenter = null
    ) {
        $this->taskManager = $taskManager ?? app(TaskManagerService::class);
        $this->queueCenter = $queueCenter ?? app(QueueCenterService::class);
    }

    /**
     * Immediate dirty bump for one dictionary language, called from
     * AppQyV1LangDictionaryModel::forgetMetricsCache on every metric-relevant
     * dictionary write. Folded into the table signature so the next serve
     * refreshes without waiting for the stats collector.
     */
    public static function noteDictionaryWrite(string $langCode): void
    {
        QueueCenterCacheStore::increment(self::DIRTY_PREFIX . sha1(strtolower($langCode)));
    }

    /**
     * Per-language backlog counts for one lane (metrics/UI surfaces).
     *
     * @return array<string,int>
     */
    public function counts(string $lane): array
    {
        $counts = [];
        foreach (DictLaneCatalog::languages() as $langCode) {
            $counts[$langCode] = count($this->laneRowsFresh($lane, $langCode));
        }

        return $counts;
    }

    /**
     * One cached page of a lane (backs dictionaryWords?filter=without_audio
     * and any lane-backed listing): the ordered id slice plus total, both
     * from the refreshed in-memory lane queue.
     *
     * @return array{total:int,ids:array<int,int>,rows:array<int,array>}
     */
    public function page(string $lane, string $langCode, int $start, int $limit): array
    {
        $rows = $this->laneRowsFresh($lane, $langCode);
        $slice = array_slice($rows, max(0, $start), max(1, $limit));

        return [
            'total' => count($rows),
            'ids' => array_values(array_map(static fn (array $row): int => (int) $row['id'], $slice)),
            'rows' => $slice,
        ];
    }

    /**
     * Move one item to the head of the cached lane queue (the in-memory head
     * half of a wordnew head notification; the global_tasks head ticket and
     * the pycore notification stay with QueueCenterService::moveToHead).
     */
    public function noteHeadMove(string $lane, string $langCode, string $md5): void
    {
        $langCode = strtolower($langCode);
        if (!isset(self::$laneCache[$lane][$langCode])) {
            return;
        }

        $rows = self::$laneCache[$lane][$langCode]['rows'];
        foreach ($rows as $index => $row) {
            if ((string) $row['md5'] !== $md5) {
                continue;
            }
            if ($index > 0) {
                unset($rows[$index]);
                array_unshift($rows, $row);
                self::$laneCache[$lane][$langCode]['rows'] = array_values($rows);
            }
            return;
        }
    }

    /**
     * Just-in-time claim materialization for one worker pull: create up to
     * $limit claim tasks from the lane's cached head, per language, honoring
     * the retired producers' pile-up guard (max live tasks per language).
     * Returns the number of tasks created.
     */
    public function ensureMaterialized(string $taskType, int $limit): int
    {
        $lane = DictLaneCatalog::laneForTaskType($taskType);
        if ($lane === null || $limit <= 0) {
            return 0;
        }

        $created = 0;
        foreach (DictLaneCatalog::languages() as $langCode) {
            if ($created >= $limit) {
                break;
            }
            if (!$this->hasClaimCapacity($lane, $taskType, $langCode)) {
                continue;
            }

            // $limit counts TASKS. Batched lanes always fill a whole legacy
            // batch per task; word_audio is one word per task, so its batch
            // is the remaining task budget.
            $batchSize = $lane === DictLaneCatalog::LANE_WORD_AUDIO
                ? $limit - $created
                : DictLaneCatalog::claimBatchSize($lane);
            $batch = $this->takeBatch($lane, $langCode, $batchSize);
            if ($batch === []) {
                continue;
            }

            try {
                $created += $this->materializeBatch($taskType, $lane, $langCode, $batch);
            } catch (\Throwable $exception) {
                $this->releaseInflight($lane, $langCode, $batch);
                Log::warning('DictLaneQueueCenter: materialize page failed', [
                    'lane' => $lane,
                    'task_type' => $taskType,
                    'language' => $langCode,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        if ($created > 0) {
            Log::info('DictLaneQueueCenter: claim tasks materialized', [
                'task_type' => $taskType,
                'created' => $created,
            ]);
        }

        return $created;
    }

    /**
     * Drop one language's cached lanes (called when the dictionary table
     * structure changes; regular writes are handled by the dirty bump).
     */
    public function invalidateLanguage(string $langCode): void
    {
        $langCode = strtolower($langCode);
        foreach (DictLaneCatalog::allCacheLanes() as $lane) {
            unset(self::$laneCache[$lane][$langCode], self::$inflight[$lane . ':' . $langCode]);
        }
    }

    // ------------------------------------------------------------------
    // Internal: lane cache freshness (probe -> minimal diff -> snapshot)
    // ------------------------------------------------------------------

    /**
     * The lane's fresh ordered lite rows for one language: memory-first, one
     * ms-level table probe per serve, one lite id-list re-fetch only when the
     * table changed.
     *
     * @return array<int,array{id:int,word:string,md5:string,query_count:int}>
     */
    private function laneRowsFresh(string $lane, string $langCode): array
    {
        $langCode = strtolower($langCode);
        $cached = self::$laneCache[$lane][$langCode] ?? $this->restoreSnapshot($lane, $langCode);

        $model = AppQyV1LangDictionaryModel::forLanguage($langCode);
        $signature = DictLaneTableProbe::signature($model->getConnectionName(), $model->getTable());
        if ($signature !== null) {
            $signature .= ':d' . (int) QueueCenterCacheStore::get()->get(
                self::DIRTY_PREFIX . sha1($langCode),
                0
            );
        }

        if ($cached !== null && $signature !== null && $cached['signature'] === $signature) {
            self::$laneCache[$lane][$langCode] = $cached;

            return $cached['rows'];
        }
        if ($signature === null && $cached !== null) {
            // Table unreadable: keep serving the last known snapshot.
            self::$laneCache[$lane][$langCode] = $cached;

            return $cached['rows'];
        }

        $fresh = DictLaneCatalog::laneRows($lane, $langCode);
        $added = 0;
        $removed = 0;
        if ($cached !== null) {
            $previousIds = array_column($cached['rows'], 'id');
            $freshIds = array_column($fresh, 'id');
            $added = count(array_diff($freshIds, $previousIds));
            $removed = count(array_diff($previousIds, $freshIds));
        }
        if ($signature === null) {
            $signature = 'unreadable:' . count($fresh);
        }

        self::$laneCache[$lane][$langCode] = [
            'signature' => $signature,
            'rows' => $fresh,
            'saved_at' => (int) ($cached['saved_at'] ?? 0),
        ];
        // A table change means write-backs landed: served words left the lane,
        // so every inflight reservation for it is settled.
        unset(self::$inflight[$lane . ':' . $langCode]);
        $this->persistSnapshotDebounced($lane, $langCode);

        if ($cached !== null && ($added > 0 || $removed > 0)) {
            Log::debug('DictLaneQueueCenter: lane diff applied', [
                'lane' => $lane,
                'language' => $langCode,
                'added' => $added,
                'removed' => $removed,
                'total' => count($fresh),
            ]);
        }

        return $fresh;
    }

    /**
     * The pile-up guard of the retired producers: a language with enough live
     * claim tasks is skipped.
     */
    private function hasClaimCapacity(string $lane, string $taskType, string $langCode): bool
    {
        $live = GlobalTask::liveTaskCount(
            'AppQyV1',
            DictLaneCatalog::liveCountTaskTypes($lane),
            QueueCenterContract::taskStatuses('live'),
            ['language' => $langCode]
        );

        return $live < DictLaneCatalog::maxLiveTasksPerLanguage($lane);
    }

    /**
     * Take the next batch from the cached lane head, skipping rows already
     * materialized into a still-live claim task (inflight reservations).
     *
     * @return array<int,array{id:int,word:string,md5:string,query_count:int}>
     */
    private function takeBatch(string $lane, string $langCode, int $batchSize): array
    {
        $rows = $this->laneRowsFresh($lane, $langCode);
        $key = $lane . ':' . $langCode;
        $inflight = self::$inflight[$key] ?? [];
        $now = time();
        foreach ($inflight as $id => $since) {
            if ($now - $since > self::INFLIGHT_TTL_SECONDS) {
                unset($inflight[$id]);
            }
        }

        $batch = [];
        foreach ($rows as $row) {
            if (count($batch) >= $batchSize) {
                break;
            }
            if (isset($inflight[(int) $row['id']])) {
                continue;
            }
            $batch[] = $row;
        }

        foreach ($batch as $row) {
            $inflight[(int) $row['id']] = $now;
        }
        self::$inflight[$key] = $inflight;

        return $batch;
    }

    /** @param array<int,array> $batch */
    private function releaseInflight(string $lane, string $langCode, array $batch): void
    {
        $key = $lane . ':' . $langCode;
        foreach ($batch as $row) {
            unset(self::$inflight[$key][(int) $row['id']]);
        }
    }

    /**
     * Create the claim task(s) for one batch. word_audio goes through
     * QueueCenterService::enqueue (group_key live-dedup, one row per word);
     * the batched lanes create ONE task per batch with the legacy payload.
     *
     * @param array<int,array{id:int,word:string,md5:string,query_count:int}> $batch
     */
    private function materializeBatch(string $taskType, string $lane, string $langCode, array $batch): int
    {
        if ($lane === DictLaneCatalog::LANE_WORD_AUDIO) {
            $created = 0;
            foreach ($batch as $row) {
                $result = $this->queueCenter->enqueue(
                    'word_audio',
                    [
                        'word' => $row['word'],
                        'language' => $langCode,
                        'md5' => $row['md5'] !== '' ? $row['md5'] : md5($row['word']),
                        'dict_row_id' => $row['id'],
                    ],
                    QueueCenterService::dedupKeyFor(
                        'word_audio',
                        $langCode,
                        $row['md5'] !== '' ? $row['md5'] : md5($row['word'])
                    )
                );
                if ($result['created']) {
                    $created++;
                } else {
                    // Already live: no new row, and no inflight reservation is
                    // needed (the live task owns the word).
                    $this->releaseInflight($lane, $langCode, [$row]);
                }
            }

            return $created;
        }

        $spec = DictLaneCatalog::claimTaskSpec($taskType, $langCode, $batch);
        $this->taskManager->createTask(
            'AppQyV1',
            $taskType,
            $spec['execution_type'],
            $spec['payload'],
            $spec['timeout_seconds'],
            $spec['priority'],
            $spec['max_retries']
        );

        return 1;
    }

    // ------------------------------------------------------------------
    // Internal: snapshot persistence (database cache store, debounced)
    // ------------------------------------------------------------------

    private function snapshotKey(string $lane, string $langCode): string
    {
        return self::SNAPSHOT_PREFIX . sha1($lane . ':' . $langCode);
    }

    private function restoreSnapshot(string $lane, string $langCode): ?array
    {
        if (isset(self::$laneCache[$lane][$langCode])) {
            return self::$laneCache[$lane][$langCode];
        }

        $payload = QueueCenterCacheStore::get()->get($this->snapshotKey($lane, $langCode));
        if (!is_string($payload) || $payload === '') {
            return null;
        }

        try {
            $decoded = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $exception) {
            return null;
        }
        if (!is_array($decoded) || !isset($decoded['signature'], $decoded['rows']) || !is_array($decoded['rows'])) {
            return null;
        }

        return [
            'signature' => (string) $decoded['signature'],
            'rows' => $decoded['rows'],
            'saved_at' => (int) ($decoded['saved_at'] ?? 0),
        ];
    }

    private function persistSnapshotDebounced(string $lane, string $langCode): void
    {
        $key = $lane . ':' . $langCode;
        $now = time();
        if ($now - (self::$snapshotSavedAt[$key] ?? 0) < self::SNAPSHOT_SAVE_INTERVAL_SECONDS) {
            return;
        }

        $state = self::$laneCache[$lane][$langCode] ?? null;
        if ($state === null) {
            return;
        }

        try {
            QueueCenterCacheStore::get()->forever($this->snapshotKey($lane, $langCode), json_encode([
                'signature' => $state['signature'],
                'rows' => $state['rows'],
                'saved_at' => $now,
            ], JSON_UNESCAPED_UNICODE));
            self::$snapshotSavedAt[$key] = $now;
        } catch (\Throwable $exception) {
            Log::warning('DictLaneQueueCenter: snapshot persist failed', [
                'lane' => $lane,
                'language' => $langCode,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
