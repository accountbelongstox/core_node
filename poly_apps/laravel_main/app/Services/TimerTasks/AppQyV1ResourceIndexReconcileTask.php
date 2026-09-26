<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ResourceIndexService;
use App\Services\DataSync\DataSyncStateStore;
use App\Utils\RedisBucketIndex;

/**
 * Incremental reconciliation of the Redis static resource index: each tick
 * re-verifies a time-boxed slice of index buckets (persisted cursor) so an
 * entry whose file or row vanished outside the write hooks stops being
 * reported as present.
 */
final class AppQyV1ResourceIndexReconcileTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 60;
    private const BUDGET_SECONDS = 2.0;

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        return RedisBucketIndex::available() && !app(DataSyncStateStore::class)->hasActiveSession();
    }

    public function exec(): void
    {
        $stats = app(AppQyV1ResourceIndexService::class)->reconcile(self::BUDGET_SECONDS);
        if ($stats['dropped'] > 0 || $stats['updated'] > 0 || $stats['pass_completed']) {
            $this->logInfo('Resource index reconciled', $stats);
        }
    }
}
