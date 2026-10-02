<?php

namespace App\Services\QueueCenter\DictLane;

use App\Services\WorkLeases\WorkLeaseLanes;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Models\GlobalTask;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use App\Support\QueueProgress;
use Illuminate\Support\Facades\Log;

/**
 * Dict-lane queue center: every dictionary lane is an indexed SQL view over
 * its AppQyV1MediaGaps predicate (DictLaneCatalog), read through the partial
 * indexes of that predicate. Nothing is cached as a lane copy, so a table that
 * changes on every write-back never forces a whole-lane rebuild:
 * - keyset listing (pageAfterId): `predicate AND id > cursor ORDER BY id LIMIT n`;
 * - claim head (ensureMaterialized): `predicate ORDER BY query_count DESC, id`,
 *   minus the words already owned by live claim tasks (database truth);
 * - counts: one COUNT on the partial index, cached per dictionary write version.
 *
 * Just-in-time materialization: global_tasks rows for a dict lane exist only
 * for words a worker actually pulled, one task per batch. word_audio is never
 * materialized: work leases hand out its gap rows (WorkLeaseService).
 */
final class DictLaneQueueCenter
{
    private const WRITE_VERSION_PREFIX = 'dict_lane:write_version:';
    private const COUNT_CACHE_PREFIX = 'dict_lane:count:';
    private const COUNT_CACHE_SECONDS = 30;
    private const MATERIALIZE_LOCK_PREFIX = 'dict_lane:materialize:';
    private const MATERIALIZE_LOCK_SECONDS = 30;
    private const LIVE_PAYLOAD_SCAN_LIMIT = 500;
    private const APP_NAME = 'AppQyV1';

    private TaskManagerService $taskManager;

    public function __construct(
        ?TaskManagerService $taskManager = null
    ) {
        $this->taskManager = $taskManager ?? app(TaskManagerService::class);
    }

    /**
     * Called from AppQyV1LangDictionaryModel::forgetMetricsCache on every
     * metric-relevant dictionary write: new counts are read on the next serve.
     */
    public static function noteDictionaryWrite(string $langCode): void
    {
        QueueCenterCacheStore::increment(self::WRITE_VERSION_PREFIX . strtolower($langCode));
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
            $counts[$langCode] = $this->count($lane, $langCode);
        }

        return $counts;
    }

    /** Backlog size of one lane in one language. */
    public function count(string $lane, string $langCode): int
    {
        return $this->cachedCount($lane, $langCode, static fn (): int => DictLaneCatalog::laneCount($lane, strtolower($langCode)));
    }

    /** One count per dictionary write version (a write makes the next serve recount). */
    private function cachedCount(string $key, string $langCode, \Closure $count): int
    {
        $langCode = strtolower($langCode);
        $version = (int) QueueCenterCacheStore::get()->get(self::WRITE_VERSION_PREFIX . $langCode, 0);

        return (int) QueueCenterCacheStore::get()->remember(
            self::COUNT_CACHE_PREFIX . $key . ':' . $langCode . ':' . $version,
            self::COUNT_CACHE_SECONDS,
            $count
        );
    }

    /**
     * One offset page of a lane in claim order (the dictionary management UI
     * page jump). Consumers that walk a whole lane use pageAfterId.
     *
     * @return array{total:int,ids:array<int,int>,rows:array<int,array>}
     */
    public function page(string $lane, string $langCode, int $start, int $limit): array
    {
        $rows = DictLaneCatalog::headRows($lane, $langCode, max(1, $limit), max(0, $start));

        return [
            'total' => $this->count($lane, $langCode),
            'ids' => array_values(array_map(static fn (array $row): int => (int) $row['id'], $rows)),
            'rows' => $rows,
        ];
    }

    /**
     * Keyset page for long-running consumers: rows completed while the
     * consumer reads cannot shift later rows, and a consumer that resumes from
     * its persisted cursor reads only rows after it.
     *
     * @return array{total:int,rows:array<int,array>,next_cursor:int,progress:array}
     */
    public function pageAfterId(string $lane, string $langCode, int $afterId, int $limit): array
    {
        $rows = DictLaneCatalog::rowsAfterId($lane, $langCode, $afterId, max(1, $limit));
        $last = end($rows);
        $nextCursor = is_array($last) ? (int) $last['id'] : $afterId;

        return [
            'total' => $this->count($lane, $langCode),
            'rows' => $rows,
            'next_cursor' => $nextCursor,
            'progress' => $this->progress($lane, $langCode, $nextCursor),
        ];
    }

    /** Contract progress_template of one gap lane in one language. */
    public function progress(string $lane, string $langCode, ?int $cursor = null): array
    {
        $pending = $this->count($lane, $langCode);
        $failed = min($pending, $this->cachedCount($lane . ':failed', $langCode, static fn (): int => DictLaneCatalog::failedCount($lane, $langCode)));
        // Estimated total (cached by TTL, not per write version): no whole-table count per dictionary write.
        $rows = max($pending, AppQyV1LangDictionaryModel::estimatedRowCount($langCode));

        return QueueProgress::make(
            max(0, $rows - $pending),
            $failed,
            $pending - $failed,
            $cursor
        );
    }

    /**
     * Just-in-time claim materialization for one worker pull: create up to
     * $limit claim tasks from the lane head, per language, honoring the
     * pile-up guard (max live tasks per language). Returns the tasks created.
     */
    public function ensureMaterialized(string $taskType, int $limit): int
    {
        $lane = DictLaneCatalog::laneForTaskType($taskType);
        $created = 0;

        // word_audio rows are handed out by work leases (WorkLeaseService), never materialized.
        if ($lane === null || $limit <= 0 || WorkLeaseLanes::isLane($taskType)) {
            return 0;
        }
        foreach (DictLaneCatalog::languages() as $langCode) {
            if ($created >= $limit) {
                break;
            }
            $created += $this->materializeLanguage(
                $taskType,
                $lane,
                $langCode,
                DictLaneCatalog::claimBatchSize($lane)
            );
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
     * One lane+language materializes under a shared lock at a time; the head
     * skips the words live claim tasks already own, so a crashed or expired
     * claim (task no longer live) makes its words claimable again.
     */
    private function materializeLanguage(string $taskType, string $lane, string $langCode, int $batchSize): int
    {
        $lock = QueueCenterCacheStore::get()->lock(
            self::MATERIALIZE_LOCK_PREFIX . sha1($lane . ':' . $langCode),
            self::MATERIALIZE_LOCK_SECONDS
        );
        $owned = [];
        $batch = [];

        if (!$lock->get()) {
            return 0;
        }
        try {
            if (!$this->hasClaimCapacity($lane, $langCode)) {
                return 0;
            }
            $owned = $this->liveClaimMd5s($lane, $langCode);
            foreach (DictLaneCatalog::claimHeadRows($lane, $langCode, $batchSize + count($owned)) as $row) {
                if (count($batch) >= $batchSize) {
                    break;
                }
                if (!isset($owned[$row['md5']])) {
                    $batch[] = $row;
                }
            }

            return $batch === [] ? 0 : $this->materializeBatch($taskType, $lane, $langCode, $batch);
        } finally {
            $lock->release();
        }
    }

    /**
     * md5s of the words carried by this lane's live claim tasks in one language.
     *
     * @return array<string,true>
     */
    private function liveClaimMd5s(string $lane, string $langCode): array
    {
        $md5s = [];

        foreach (GlobalTask::liveTaskPayloads(
            self::APP_NAME,
            DictLaneCatalog::liveCountTaskTypes($lane),
            QueueCenterContract::taskStatuses('live'),
            ['language' => $langCode],
            self::LIVE_PAYLOAD_SCAN_LIMIT
        ) as $payload) {
            if (is_string($payload['md5'] ?? null) && $payload['md5'] !== '') {
                $md5s[$payload['md5']] = true;
            }
            foreach ((array) ($payload['words'] ?? []) as $word) {
                $md5 = is_array($word) ? (string) ($word['md5'] ?? '') : '';
                if ($md5 !== '') {
                    $md5s[$md5] = true;
                }
            }
        }

        return $md5s;
    }

    private function hasClaimCapacity(string $lane, string $langCode): bool
    {
        return GlobalTask::liveTaskCount(
            self::APP_NAME,
            DictLaneCatalog::liveCountTaskTypes($lane),
            QueueCenterContract::taskStatuses('live'),
            ['language' => $langCode]
        ) < DictLaneCatalog::maxLiveTasksPerLanguage($lane);
    }

    /**
     * One task per batch with the legacy payload.
     *
     * @param array<int,array{id:int,word:string,md5:string,query_count:int}> $batch
     */
    private function materializeBatch(string $taskType, string $lane, string $langCode, array $batch): int
    {
        $spec = [];

        $spec = DictLaneCatalog::claimTaskSpec($taskType, $langCode, $batch);
        $this->taskManager->createTask(
            self::APP_NAME,
            $taskType,
            $spec['execution_type'],
            $spec['payload'],
            $spec['timeout_seconds'],
            $spec['priority'],
            $spec['max_retries']
        );

        return 1;
    }
}
