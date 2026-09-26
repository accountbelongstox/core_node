<?php

namespace App\Services\QueueCenter\DictLane;

use App\Models\GlobalTask;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Services\PriorityAgeService;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\TaskManagerService;
use Illuminate\Support\Facades\Log;

/**
 * On-demand global task maintenance (docs_fix/DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md §2.5).
 *
 * Replaces the 15s GlobalTaskMaintenanceTask poller: lease recovery, offline
 * worker cleanup, and priority aging run INSIDE the worker pull path —
 * exactly when consumers are active — throttled to one slice per
 * MAINTENANCE_INTERVAL_SECONDS across all workers (database cache store
 * timestamp). Slow-path janitor work (terminal purge, never-assigned expiry,
 * legacy retag) runs once per SLOW_INTERVAL_SECONDS; the zero-byte audio
 * cleanup keeps the retired audio scan's 5% roll on slow slices.
 */
final class DictLaneMaintenance
{
    private const MAINTENANCE_INTERVAL_SECONDS = 15;
    private const SLOW_INTERVAL_SECONDS = 3600;
    private const LAST_RUN_KEY = 'dict_lane:maintenance:last_run:v1';
    private const LAST_SLOW_KEY = 'dict_lane:maintenance:last_slow:v1';
    private const PURGE_BATCH_LIMIT = 500;
    private const RETAIN_COMPLETED_DAYS = 7;
    private const RETAIN_FAILED_DAYS = 30;
    private const STALE_PENDING_NEVER_ASSIGNED_DAYS = 7;
    private const RETAIN_OFFLINE_WORKER_DAYS = 7;

    /**
     * Pull-path hook: run one throttled maintenance slice. Cheap when another
     * worker ran it recently (one cache read).
     */
    public static function onPull(TaskManagerService $taskManager): void
    {
        $cache = QueueCenterCacheStore::get();
        $now = time();
        $lastRun = (int) $cache->get(self::LAST_RUN_KEY, 0);
        if ($now - $lastRun < self::MAINTENANCE_INTERVAL_SECONDS) {
            return;
        }
        $cache->forever(self::LAST_RUN_KEY, $now);

        try {
            $released = $taskManager->releaseTimedOutTasks();
            $cleaned = $taskManager->cleanOfflineWorkers();
            $aged = app(PriorityAgeService::class)->ageTasksPriority();
            if ($released > 0 || $cleaned > 0 || $aged > 0) {
                Log::info('DictLaneMaintenance: on-demand slice', [
                    'tasks_released' => $released,
                    'workers_marked_offline' => $cleaned,
                    'tasks_aged' => $aged,
                ]);
            }
        } catch (\Throwable $exception) {
            Log::warning('DictLaneMaintenance: slice failed', [
                'error' => $exception->getMessage(),
            ]);
        }

        $lastSlow = (int) $cache->get(self::LAST_SLOW_KEY, 0);
        if ($now - $lastSlow >= self::SLOW_INTERVAL_SECONDS) {
            $cache->forever(self::LAST_SLOW_KEY, $now);
            self::slowSlice();
        }
    }

    /**
     * Hourly janitor slice: the retired maintenance task's slow paths
     * (bounded purges, never-assigned expiry, legacy retag, stale worker
     * purge) plus the zero-byte audio cleanup roll.
     */
    private static function slowSlice(): void
    {
        try {
            $purged = GlobalTask::purgeTerminalBatches([
                [
                    'statuses' => [
                        GlobalTask::status('completed'),
                        GlobalTask::status('completed_demo'),
                        GlobalTask::status('cancelled'),
                    ],
                    'before' => now()->subDays(self::RETAIN_COMPLETED_DAYS),
                ],
                [
                    'statuses' => [GlobalTask::status('failed')],
                    'before' => now()->subDays(self::RETAIN_FAILED_DAYS),
                ],
            ], self::PURGE_BATCH_LIMIT);
            $expired = GlobalTask::expireNeverAssignedPending(
                now()->subDays(self::STALE_PENDING_NEVER_ASSIGNED_DAYS),
                self::PURGE_BATCH_LIMIT
            );
            $retagged = GlobalTask::retagPendingTasks(
                ['dictionary_explanation', 'dictionary_explanation_demo'],
                [GlobalTask::executionType('remote_translation')],
                GlobalTask::executionType('remote_client')
            );
            $workersPurged = \App\Models\Worker::purgeOfflineBefore(
                now()->subDays(self::RETAIN_OFFLINE_WORKER_DAYS)
            );

            if ($purged > 0 || $expired > 0 || $retagged > 0 || $workersPurged > 0) {
                Log::info('DictLaneMaintenance: slow slice', [
                    'terminal_tasks_purged' => $purged,
                    'stale_pending_expired' => $expired,
                    'legacy_tasks_retagged' => $retagged,
                    'stale_workers_purged' => $workersPurged,
                ]);
            }
        } catch (\Throwable $exception) {
            Log::warning('DictLaneMaintenance: slow slice failed', [
                'error' => $exception->getMessage(),
            ]);
        }

        // Zero-byte audio cleanup, carried over from the retired
        // QueueCenterAudioScanTask (same 5% roll, now on slow slices).
        if (random_int(1, 100) <= 5) {
            try {
                app(EdgeTTSService::class)->cleanZeroByteFilesMaintenance();
            } catch (\Throwable $exception) {
                Log::warning('DictLaneMaintenance: zero-byte audio cleanup skipped', [
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }
}
