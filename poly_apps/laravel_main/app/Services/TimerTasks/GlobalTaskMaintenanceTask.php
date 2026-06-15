<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Models\Worker;
use App\Services\TaskManagerService;

/**
 * Global Task System Maintenance
 *
 * Recovery half of the global_tasks worker substrate. TaskManagerService has
 * always shipped releaseTimedOutTasks() and cleanOfflineWorkers(), but nothing
 * ever invoked them — so a task whose worker died (or whose result POST was
 * lost to a transient 5xx) stayed "assigned" forever and the queue silently
 * starved. This timer is the missing caller.
 *
 * Every tick (15s):
 *   1. releaseTimedOutTasks()  — any task whose timeout_at has passed goes back
 *      to pending so another worker's atomic pull can claim it. This is the
 *      recovery path that makes N racing pycore workers safe: a worker can
 *      crash mid-task (or its result POST can fail) and the task is re-offered
 *      instead of leaking.
 *   2. cleanOfflineWorkers()   — workers silent past the heartbeat timeout are
 *      marked offline and their current task released.
 *   3. Legacy fixup: dictionary_explanation(_demo) tasks created before the
 *      execution-type fix carry execution_type=remote_translation, which routes
 *      them to the pycore/AI word-translation consumers that cannot process
 *      them. Pending rows are re-tagged to remote_client (the browser
 *      dictionary worker's processor type). Idempotent and index-backed; costs
 *      one UPDATE matching zero rows once the backlog is drained.
 */
class GlobalTaskMaintenanceTask extends OctaneTimerTaskAbstract
{
    // Retention policy: terminal tasks are transient bookkeeping (their real
    // output lives in the app tables, e.g. the dictionary rows), so they are
    // purged after a grace window. Failed tasks are kept longer for diagnosis.
    // Deletes are capped per tick so a large backlog never holds a long lock.
    private const RETAIN_COMPLETED_DAYS = 7;
    private const RETAIN_FAILED_DAYS = 30;
    private const PURGE_BATCH_LIMIT = 500;

    // Worker rows whose heartbeat is this old are deleted (they re-register on
    // their next start — registration is updateOrCreate by worker_id, so
    // deleting a dead row loses nothing but stale counters).
    private const RETAIN_OFFLINE_WORKER_DAYS = 7;

    private $taskManager;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
    }

    public function getInterval(): int
    {
        return 15;
    }

    public function exec(): void
    {
        $released = $this->taskManager->releaseTimedOutTasks();
        $cleaned = $this->taskManager->cleanOfflineWorkers();
        $retagged = $this->retagLegacyDictionaryTasks();
        $purged = $this->purgeExpiredTerminalTasks();
        $workersPurged = $this->purgeStaleWorkers();

        if ($released > 0 || $cleaned > 0 || $retagged > 0 || $purged > 0 || $workersPurged > 0) {
            $this->logInfo('Maintenance cycle', [
                'tasks_released' => $released,
                'workers_marked_offline' => $cleaned,
                'legacy_tasks_retagged' => $retagged,
                'terminal_tasks_purged' => $purged,
                'stale_workers_purged' => $workersPurged,
            ]);
        }
    }

    /**
     * Delete worker rows that have been silent past the retention window.
     * Only OFFLINE workers qualify (cleanOfflineWorkers marks them and releases
     * their task first), plus never-heartbeated rows older than the window
     * (failed registrations / test leftovers). Live workers re-register via
     * updateOrCreate, so deletion is safe.
     */
    private function purgeStaleWorkers(): int
    {
        $cutoff = now()->subDays(self::RETAIN_OFFLINE_WORKER_DAYS);

        return Worker::query()
            ->where('status', Worker::STATUS_OFFLINE)
            ->where(function ($query) use ($cutoff) {
                $query->where('last_heartbeat_at', '<', $cutoff)
                    ->orWhere(function ($q) use ($cutoff) {
                        $q->whereNull('last_heartbeat_at')
                            ->where('created_at', '<', $cutoff);
                    });
            })
            ->delete();
    }

    /**
     * Delete terminal tasks past their retention window (bounded per tick).
     * completed/completed_demo/cancelled age out after RETAIN_COMPLETED_DAYS;
     * failed after RETAIN_FAILED_DAYS. Ages are measured from updated_at (the
     * last transition), so a retried-then-failed task counts from its final
     * failure, not its creation.
     */
    private function purgeExpiredTerminalTasks(): int
    {
        $purged = 0;

        $batches = [
            [
                'statuses' => [
                    GlobalTask::STATUS_COMPLETED,
                    GlobalTask::STATUS_COMPLETED_DEMO,
                    GlobalTask::STATUS_CANCELLED,
                ],
                'before' => now()->subDays(self::RETAIN_COMPLETED_DAYS),
            ],
            [
                'statuses' => [GlobalTask::STATUS_FAILED],
                'before' => now()->subDays(self::RETAIN_FAILED_DAYS),
            ],
        ];

        foreach ($batches as $batch) {
            $remaining = self::PURGE_BATCH_LIMIT - $purged;
            if ($remaining <= 0) {
                break;
            }

            // Select-then-delete by primary key keeps the delete bounded
            // (SQLite/Postgres lack DELETE ... LIMIT portability).
            $ids = GlobalTask::query()
                ->whereIn('status', $batch['statuses'])
                ->where('updated_at', '<', $batch['before'])
                ->limit($remaining)
                ->pluck('id');

            if ($ids->isNotEmpty()) {
                $purged += GlobalTask::whereIn('id', $ids)->delete();
            }
        }

        return $purged;
    }

    /**
     * Re-tag pending dictionary_explanation tasks that were created with
     * execution_type=remote_translation so they reach their real consumer
     * (remote_client). Only pending rows are touched; a mis-typed assigned row
     * is first recovered by releaseTimedOutTasks() and re-tagged next tick.
     */
    private function retagLegacyDictionaryTasks(): int
    {
        return GlobalTask::query()
            ->whereIn('task_type', ['dictionary_explanation', 'dictionary_explanation_demo'])
            ->where('execution_type', GlobalTask::EXECUTION_REMOTE_TRANSLATION)
            ->where('status', GlobalTask::STATUS_PENDING)
            ->update(['execution_type' => GlobalTask::EXECUTION_REMOTE_CLIENT]);
    }
}
