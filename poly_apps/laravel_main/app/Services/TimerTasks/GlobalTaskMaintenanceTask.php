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

    // A pending task that has NEVER been assigned (no worker ever claimed it)
    // older than this is expired: its lane has no online worker that can serve
    // it, so leaving it pending forever only pollutes the queue and the Queue
    // Center "stuck" count. Mark it failed with a clear reason so the producer/
    // UI can see WHY it died (e.g. "no worker for lane remote_client").
    private const STALE_PENDING_NEVER_ASSIGNED_DAYS = 7;

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
        $mediaRetagged = $this->retagLegacyWordMediaTasks();
        $expired = $this->expireStalePendingTasks();
        $purged = $this->purgeExpiredTerminalTasks();
        $workersPurged = $this->purgeStaleWorkers();
        // Anti-starvation: nudge long-waiting background tasks up so the FAST
        // interactive tier cannot indefinitely starve them (capped below FAST).
        $aged = app(\App\Services\PriorityAgeService::class)->ageTasksPriority();

        if ($released > 0 || $cleaned > 0 || $retagged > 0 || $mediaRetagged > 0 || $expired > 0 || $purged > 0 || $workersPurged > 0 || $aged > 0) {
            $this->logInfo('Maintenance cycle', [
                'tasks_released' => $released,
                'workers_marked_offline' => $cleaned,
                'legacy_tasks_retagged' => $retagged,
                'legacy_word_media_retagged' => $mediaRetagged,
                'stale_pending_expired' => $expired,
                'terminal_tasks_purged' => $purged,
                'stale_workers_purged' => $workersPurged,
                'tasks_aged' => $aged,
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

    /** Move legacy word_media rows onto the image-capability fast lane. */
    private function retagLegacyWordMediaTasks(): int
    {
        return GlobalTask::query()
            ->where('task_type', 'word_media')
            ->whereIn('execution_type', [
                GlobalTask::EXECUTION_REMOTE_CLIENT,
                GlobalTask::EXECUTION_REMOTE_TRANSLATION,
            ])
            ->where('status', GlobalTask::STATUS_PENDING)
            ->update([
                'execution_type' => GlobalTask::EXECUTION_REMOTE_FAST,
                'capability' => GlobalTask::CAPABILITY_IMAGE,
            ]);
    }

    /**
     * Expire pending tasks that have NEVER been claimed (assigned_to IS NULL)
     * and are older than STALE_PENDING_NEVER_ASSIGNED_DAYS. A never-assigned
     * pending task this old means NO online worker registers a processor_type
     * that can serve its execution_type (e.g. remote_client dictionary tasks
     * with no browser worker, or a remote_fast image task with no image-capable
     * worker). Leaving it pending forever only pollutes the queue; failing it
     * with a clear reason makes the "stuck" cause self-diagnosing. Bounded per
     * tick like the terminal purge. A task that WAS assigned then released keeps
     * its assigned_at, so it is NOT expired here (releaseTimedOutTasks owns it).
     */
    private function expireStalePendingTasks(): int
    {
        $cutoff = now()->subDays(self::STALE_PENDING_NEVER_ASSIGNED_DAYS);

        // Fetch id + execution_type together (no per-row subquery in the loop).
        $rows = GlobalTask::query()
            ->where('status', GlobalTask::STATUS_PENDING)
            ->whereNull('assigned_to')
            ->whereNull('assigned_at')
            ->where('created_at', '<', $cutoff)
            ->limit(self::PURGE_BATCH_LIMIT)
            ->get(['id', 'execution_type']);

        if ($rows->isEmpty()) {
            return 0;
        }

        // Fail each with a lane-specific reason so the "stuck" cause is visible.
        $expired = 0;
        foreach ($rows as $task) {
            $updated = GlobalTask::where('id', $task->id)
                ->where('status', GlobalTask::STATUS_PENDING)
                ->update([
                    'status' => GlobalTask::STATUS_FAILED,
                    'error' => 'expired: no worker registered for lane ' . $task->execution_type,
                    'updated_at' => now(),
                ]);
            $expired += (int) $updated;
        }

        return $expired;
    }
}
