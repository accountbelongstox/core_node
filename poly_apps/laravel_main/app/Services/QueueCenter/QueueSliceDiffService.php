<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

final class QueueSliceDiffService
{
    private const REVISION_PREFIX = 'queue_center:slice_revision:';

    public function markChanged(string $taskType): int
    {
        // Single atomic counter bump on the database cache store — no lock
        // block, no synchronous metric rebuild. The diff is only a "head
        // moved, re-pull a bounded batch" signal; stats refresh on the
        // metrics TTL, never inside this hot path.
        return QueueCenterCacheStore::increment(self::REVISION_PREFIX . $taskType);
    }

    /**
     * Hot-path contract: an unchanged revision answers in milliseconds — one
     * indexed database-cache read and zero metric rebuilds. The diff
     * only signals "the head moved, re-pull a bounded batch"; it never stops
     * consumer processing and never carries payload. Head IDs and progress
     * materialize only when the caller's cursor is stale (cursor=0 pull-side
     * snapshots are always stale, so pull responses keep carrying progress).
     */
    public function snapshot(string $taskType, int $cursor = 0, bool $includeHead = true): array
    {
        $revision = $this->revision($taskType);
        $changed = $cursor !== $revision;
        $delivery = QueueCenterContract::diffDelivery();
        $pollInterval = max(250, (int) ($delivery['poll_interval_ms'] ?? 1000));
        $sliceLimit = QueueCenterContract::consumerSliceLimit($taskType);
        $headTaskIds = [];
        $progress = null;
        if ($changed) {
            if ($includeHead) {
                $headTaskIds = GlobalTask::pendingHeadTaskIds(
                    $taskType,
                    $sliceLimit
                );
            }
            $progress = app(QueueCenterMetricsService::class)->progress($taskType);
        }

        return [
            'queue' => $taskType,
            'cursor' => $revision,
            'changed' => $changed,
            'cached' => !$changed,
            'poll_after_ms' => $pollInterval,
            'slice_limit' => $sliceLimit,
            'head_task_ids' => $headTaskIds,
            'progress' => $progress,
        ];
    }

    private function revision(string $taskType): int
    {
        $revisionKey = self::REVISION_PREFIX . $taskType;
        $cache = QueueCenterCacheStore::get();
        $revision = (int) $cache->get($revisionKey, 0);
        if ($revision > 0) {
            return $revision;
        }

        return QueueCenterCacheStore::initialize($revisionKey, 1);
    }

}
