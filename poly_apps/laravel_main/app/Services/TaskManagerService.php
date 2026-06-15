<?php

namespace App\Services;

use App\Models\GlobalTask;
use App\Models\Worker;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\ConnectionInterface;
use App\Services\TaskProcessors\TaskProcessorRegistry;
use App\Services\TaskProcessors\DictionaryTaskProcessor;
use App\Services\TaskProcessors\WordTranslationTaskProcessor;

class TaskManagerService
{
    /**
     * Transaction attempts for the worker-API hot paths (pull / submit).
     *
     * N pycore workers + the internal AI filler + the Octane timers all hit
     * global_tasks concurrently. On the SQLite deployment that surfaces as
     * "database is locked" (single writer), on Postgres as serialization /
     * deadlock errors — both are transient concurrency errors that Laravel's
     * transaction() retries when given attempts > 1, instead of bubbling up as
     * an HTTP 500 that loses a worker's result POST.
     */
    private const TRANSACTION_ATTEMPTS = 3;

    protected ?TaskProcessorRegistry $processorRegistry = null;

    protected function db(): ConnectionInterface
    {
        return app('db.connection');
    }

    /**
     * Get or create task processor registry
     */
    protected function getProcessorRegistry(): TaskProcessorRegistry
    {
        if ($this->processorRegistry === null) {
            $this->processorRegistry = new TaskProcessorRegistry();

            // Register all task processors here
            $this->processorRegistry->register(new DictionaryTaskProcessor($this));

            // Async word-translation pipeline write-back (word_translation tasks).
            $this->processorRegistry->register(new WordTranslationTaskProcessor($this));

            // Future processors can be registered here:
            // $this->processorRegistry->register(new ImageTaskProcessor($this));
            // $this->processorRegistry->register(new VideoTaskProcessor($this));
        }

        return $this->processorRegistry;
    }

    /**
     * Create a new task
     */
    public function createTask(
        string $appName,
        string $taskType,
        string $executionType,
        array $payload = [],
        int $timeoutSeconds = 120,
        int $priority = 0,
        int $maxRetries = 3
    ): GlobalTask {
        $task = GlobalTask::create([
            'task_id' => 'task_' . Str::uuid(),
            'app_name' => $appName,
            'task_type' => $taskType,
            'execution_type' => $executionType,
            'status' => GlobalTask::STATUS_PENDING,
            'payload' => $payload,
            'timeout_seconds' => $timeoutSeconds,
            'priority' => $priority,
            'max_retries' => $maxRetries,
            'progress' => 0,
            'retry_count' => 0,
        ]);

        Log::info('Task created', [
            'task_id' => $task->task_id,
            'app_name' => $appName,
            'task_type' => $taskType,
            'execution_type' => $executionType,
        ]);

        return $task;
    }

    // NOTE: the old non-atomic pullTasksForWorker() was removed — it pulled
    // without assigning (two workers could grab the same task) and had no
    // callers. pullAndAssignTasksForWorker() below is the only pull path.

    /**
     * Pull and assign tasks for a worker (atomic operation)
     * This avoids race condition between pull and accept
     *
     * @param string $workerId Worker ID
     * @param int $limit Maximum number of tasks to return
     * @return array Array of assigned tasks
     */
    public function pullAndAssignTasksForWorker(string $workerId, int $limit = 5): array
    {
        // Use single transaction for all operations. LOCK ORDER: worker row
        // first, then task rows — submitResult() acquires its locks in the SAME
        // order, so a concurrent pull and result-submit for one worker serialize
        // instead of deadlocking (opposite orders deadlock on Postgres).
        $assignedTasks = $this->db()->transaction(function () use ($workerId, $limit) {
            // Lock worker for update
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                throw new \Exception("Worker not found: $workerId");
            }

            Log::info('[pullAndAssignTasksForWorker] Worker locked', [
                'worker_id' => $workerId,
                'processor_types' => $worker->processor_types,
                'status' => $worker->status,
            ]);

            $assignedTasks = [];

            foreach ($worker->processor_types as $processorType) {
                if (count($assignedTasks) >= $limit) {
                    break;
                }

                Log::info('[pullAndAssignTasksForWorker] Checking processor type', [
                    'processor_type' => $processorType,
                ]);

                $availableTasks = GlobalTask::pending()
                    ->where('execution_type', $processorType)
                    ->orderBy('priority', 'desc')
                    ->orderBy('created_at', 'asc')
                    ->limit($limit - count($assignedTasks))
                    ->lockForUpdate()
                    ->get();

                Log::info('[pullAndAssignTasksForWorker] Found tasks for processor type', [
                    'processor_type' => $processorType,
                    'task_count' => $availableTasks->count(),
                ]);

                foreach ($availableTasks as $task) {
                    $task->assignTo($workerId, $task->timeout_seconds);
                    $worker->assignTask($task->task_id);
                    $assignedTasks[] = $task;

                    Log::info('[pullAndAssignTasksForWorker] Task assigned', [
                        'task_id' => $task->task_id,
                        'execution_type' => $task->execution_type,
                    ]);

                    if (count($assignedTasks) >= $limit) {
                        break 2;
                    }
                }
            }

            return $assignedTasks;
        }, self::TRANSACTION_ATTEMPTS);

        Log::info('[pullAndAssignTasksForWorker] Transaction completed', [
            'worker_id' => $workerId,
            'assigned_count' => count($assignedTasks),
        ]);

        return $assignedTasks;
    }

    /**
     * Assign a task to a worker
     *
     * @param string $taskId Task ID
     * @param string $workerId Worker ID
     * @return bool Success
     */
    public function assignTask(string $taskId, string $workerId): bool
    {
        $taskData = null;

        $success = $this->db()->transaction(function () use ($taskId, $workerId, &$taskData) {
            // LOCK ORDER: worker first, then task (same as pull/submit) so
            // concurrent assign/pull/submit cannot deadlock on opposite orders.
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                throw new \Exception("Worker not found: $workerId");
            }

            // Lock and reload task
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                throw new \Exception("Task not found: $taskId");
            }

            // Check if task is already assigned
            if ($task->status !== GlobalTask::STATUS_PENDING) {
                Log::warning('Task already assigned or not pending', [
                    'task_id' => $taskId,
                    'status' => $task->status,
                    'assigned_to' => $task->assigned_to,
                ]);
                return false;
            }

            // Assign task
            $task->assignTo($workerId, $task->timeout_seconds);
            $worker->assignTask($taskId);

            Log::info('Task assigned', [
                'task_id' => $taskId,
                'worker_id' => $workerId,
                'timeout_at' => $task->timeout_at,
            ]);

            $taskData = [
                'worker_id' => $workerId,
                'task_id' => $task->task_id,
                'task_type' => $task->task_type,
                'payload' => $task->payload,
                'timeout_seconds' => $task->timeout_seconds,
                'priority' => $task->priority,
            ];

            return true;
        }, self::TRANSACTION_ATTEMPTS);

        return $success;
    }

    /**
     * Accept (acknowledge) a task for a worker.
     *
     * The documented worker contract includes a pull -> accept -> result flow,
     * and remote clients (e.g. the browser dictionary worker) call accept for
     * every task — but pull already assigns atomically, so accept is an
     * IDEMPOTENT ACKNOWLEDGMENT: confirming a task the caller already owns
     * succeeds; a still-pending task is claimed atomically (legacy flow); a
     * task owned by another worker is a conflict.
     *
     * @return string One of 'accepted', 'not_found', 'conflict'
     */
    public function acceptTask(string $taskId, string $workerId): string
    {
        return $this->db()->transaction(function () use ($taskId, $workerId) {
            // Same lock order as pull/assign/submit: worker first, then task.
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                return 'not_found';
            }

            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                return 'not_found';
            }

            // Already ours (the normal case after an atomic pull) — idempotent.
            if ($task->assigned_to === $workerId
                && in_array($task->status, [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING], true)) {
                return 'accepted';
            }

            // Legacy pull-without-assign flow: claim a still-pending task now.
            if ($task->status === GlobalTask::STATUS_PENDING) {
                $task->assignTo($workerId, $task->timeout_seconds);
                $worker->assignTask($taskId);
                return 'accepted';
            }

            // Owned by another worker / already terminal.
            return 'conflict';
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Cancel a task (admin / control-plane action).
     *
     * Pending tasks cancel directly; assigned/processing tasks are revoked
     * from their worker (the worker's in-flight result will be rejected by the
     * submitResult ownership check and dropped). Terminal tasks are left
     * untouched.
     *
     * @return string One of 'cancelled', 'not_found', 'not_cancellable'
     */
    public function cancelTask(string $taskId): string
    {
        return $this->db()->transaction(function () use ($taskId) {
            // Lock-order exception: cancel must read the task to learn its
            // worker, so it locks task -> worker (opposite of pull/submit).
            // It is a rare admin action; a deadlock with a concurrent pull is
            // detected by the DB and absorbed by the attempts=3 retry.
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                return 'not_found';
            }

            $cancellable = [
                GlobalTask::STATUS_PENDING,
                GlobalTask::STATUS_ASSIGNED,
                GlobalTask::STATUS_PROCESSING,
            ];
            if (!in_array($task->status, $cancellable, true)) {
                return 'not_cancellable';
            }

            $workerId = $task->assigned_to;
            $task->status = GlobalTask::STATUS_CANCELLED;
            $task->assigned_to = null;
            $task->assigned_at = null;
            $task->timeout_at = null;
            $task->completed_at = now();
            $task->save();

            if ($workerId) {
                $worker = Worker::where('worker_id', $workerId)
                    ->lockForUpdate()
                    ->first();
                if ($worker && $worker->current_task_id === $taskId) {
                    $worker->releaseTask();
                }
            }

            Log::info('Task cancelled', [
                'task_id' => $taskId,
                'revoked_from' => $workerId,
            ]);

            return 'cancelled';
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Submit task result from worker
     *
     * @param string $taskId Task ID
     * @param string $workerId Worker ID
     * @param string $status Status (processing, completed, failed)
     * @param float $progress Progress percentage
     * @param array|null $result Result data
     * @param string|null $error Error message
     * @return bool Success
     */
    public function submitResult(
        string $taskId,
        string $workerId,
        string $status,
        float $progress = 0,
        ?array $result = null,
        ?string $error = null
    ): bool {
        $success = $this->db()->transaction(function () use ($taskId, $workerId, $status, $progress, $result, $error) {
            // LOCK ORDER: worker first, then task — the same order
            // pullAndAssignTasksForWorker uses. Locking task->worker here while a
            // concurrent pull locked worker->tasks was a classic lock-ordering
            // deadlock under multiple racing workers.
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            // Unknown worker/task is a caller error, not a server fault: return
            // false (HTTP 409 at the controller) instead of throwing a 500 the
            // worker would pointlessly retry.
            if (!$worker) {
                Log::warning('Result submitted by unknown worker', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                ]);
                return false;
            }

            // Lock and reload task
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                Log::warning('Result submitted for unknown task', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                ]);
                return false;
            }

            // Check if this worker is assigned to this task
            if ($task->assigned_to !== $workerId) {
                Log::warning('Worker not assigned to task or task was reassigned', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'assigned_to' => $task->assigned_to,
                ]);
                return false;
            }

            // Idempotent re-delivery guard: workers RETRY result POSTs on
            // transient errors, so a result whose first attempt committed but
            // whose response was lost arrives again. Acknowledge it as success
            // WITHOUT reprocessing — re-running the completed branch would run
            // the task processors (write-back) a second time and double-count
            // worker stats.
            $terminalStatuses = [
                GlobalTask::STATUS_COMPLETED,
                GlobalTask::STATUS_COMPLETED_DEMO,
                GlobalTask::STATUS_FAILED,
                GlobalTask::STATUS_CANCELLED,
            ];
            if (in_array($task->status, $terminalStatuses, true)) {
                Log::info('Result re-delivered for terminal task — acknowledged without reprocessing', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'task_status' => $task->status,
                    'reported_status' => $status,
                ]);
                return true;
            }

            // Update task based on status
            if ($status === 'completed') {
                // Check demo mode: priority to frontend-submitted flag
                $isDemoMode = $result['is_demo_mode'] ?? $task->payload['is_demo_mode'] ?? false;

                // Use consistent completion method for both modes
                if ($isDemoMode) {
                    $task->status = GlobalTask::STATUS_COMPLETED_DEMO;
                } else {
                    $task->status = GlobalTask::STATUS_COMPLETED;
                }
                $task->progress = 100.0;
                $task->result = $result ?? [];
                $task->completed_at = now();
                $task->save();

                $worker->incrementCompleted();
                $worker->releaseTask();

                Log::info('Task completed', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'demo_mode' => $isDemoMode,
                ]);

                // Process task result within transaction
                $this->processTaskResultInTransaction($task, $result ?? [], $isDemoMode);
            } elseif ($status === 'failed') {
                $failError = $error ?? 'Unknown error';

                // Check if will retry BEFORE incrementing failed count
                $willRetry = $task->canRetry();

                $task->fail($failError);

                // Only increment failed count for permanent failures
                if (!$willRetry) {
                    $worker->incrementFailed();
                }
                $worker->releaseTask();

                if ($willRetry) {
                    $task->releaseAssignment();
                    Log::info('Task failed, will retry', [
                        'task_id' => $taskId,
                        'retry_count' => $task->retry_count,
                        'max_retries' => $task->max_retries,
                    ]);
                } else {
                    Log::error('Task failed permanently', [
                        'task_id' => $taskId,
                        'error' => $error,
                    ]);
                }
            } elseif ($status === 'processing') {
                $task->status = GlobalTask::STATUS_PROCESSING;
                $task->progress = $progress;
                if ($result) {
                    $task->result = $result;
                }
                // A progress report proves the worker is alive — extend the
                // timeout lease so a long-running task is not reclaimed
                // mid-flight (the timed-out scope now also covers `processing`,
                // so without this a slow task would be double-processed).
                if ($task->timeout_seconds) {
                    $task->timeout_at = now()->addSeconds($task->timeout_seconds);
                }
                $task->save();

                Log::debug('Task progress updated', [
                    'task_id' => $taskId,
                    'progress' => $progress,
                ]);
            }

            return true;
        }, self::TRANSACTION_ATTEMPTS);

        return $success;
    }

    /**
     * Release timed out tasks (called by OctaneTimer)
     *
     * A timeout CONSUMES a retry attempt: a "poison" task whose worker always
     * dies mid-flight without reporting used to cycle claim -> timeout ->
     * release forever (releaseAssignment never touched retry_count). Now each
     * timeout increments retry_count, and once max_retries is exhausted the
     * task is failed permanently instead of being re-offered.
     *
     * @return int Number of tasks released (or failed-out)
     */
    public function releaseTimedOutTasks(): int
    {
        $tasks = GlobalTask::timedOut()->get();
        $count = 0;

        foreach ($tasks as $task) {
            $workerId = $task->assigned_to;

            if ($task->canRetry()) {
                $task->retry_count++;
                $task->releaseAssignment();

                Log::warning('Task timed out and released', [
                    'task_id' => $task->task_id,
                    'worker_id' => $workerId,
                    'retry_count' => $task->retry_count,
                    'max_retries' => $task->max_retries,
                ]);
            } else {
                $task->status = GlobalTask::STATUS_FAILED;
                $task->error = 'Timed out '
                    . ($task->retry_count + 1)
                    . ' time(s) without a worker result (last worker: '
                    . ($workerId ?? 'unknown') . ')';
                $task->assigned_to = null;
                $task->assigned_at = null;
                $task->timeout_at = null;
                $task->save();

                Log::error('Task failed permanently after repeated timeouts', [
                    'task_id' => $task->task_id,
                    'worker_id' => $workerId,
                    'retry_count' => $task->retry_count,
                ]);
            }

            // Update worker status
            if ($workerId) {
                $worker = Worker::where('worker_id', $workerId)->first();
                if ($worker && $worker->current_task_id === $task->task_id) {
                    $worker->releaseTask();
                }
            }

            $count++;
        }

        return $count;
    }

    /**
     * Clean offline workers (called by OctaneTimer)
     *
     * @return int Number of workers cleaned
     */
    public function cleanOfflineWorkers(): int
    {
        $workerIds = Worker::where('last_heartbeat_at', '<', now()->subSeconds(Worker::HEARTBEAT_TIMEOUT))
            ->whereNotNull('last_heartbeat_at')
            ->where('status', '!=', Worker::STATUS_OFFLINE)
            ->pluck('worker_id')
            ->toArray();

        $count = 0;

        foreach ($workerIds as $workerId) {
            $this->db()->transaction(function () use ($workerId, &$count) {
                // Lock worker for update
                $worker = Worker::where('worker_id', $workerId)
                    ->lockForUpdate()
                    ->first();

                if (!$worker) {
                    return;
                }

                // Recheck heartbeat after lock (may have updated)
                if ($worker->last_heartbeat_at >= now()->subSeconds(Worker::HEARTBEAT_TIMEOUT)) {
                    return;
                }

                // Release any assigned tasks
                if ($worker->current_task_id) {
                    $task = GlobalTask::where('task_id', $worker->current_task_id)
                        ->lockForUpdate()
                        ->first();

                    if ($task && $task->status === GlobalTask::STATUS_ASSIGNED) {
                        $task->releaseAssignment();
                        Log::warning('Task released due to worker offline', [
                            'task_id' => $task->task_id,
                            'worker_id' => $worker->worker_id,
                        ]);
                    }
                }

                $worker->markOffline();
                $count++;

                Log::info('Worker marked offline', [
                    'worker_id' => $worker->worker_id,
                    'last_heartbeat' => $worker->last_heartbeat_at,
                ]);
            });
        }

        return $count;
    }

    /**
     * Get task statistics
     *
     * @return array Statistics
     */
    public function getTaskStats(): array
    {
        // ONE grouped query instead of seven full-table counts; the response
        // covers the complete status vocabulary (incl. cancelled) so every
        // consumer (dashboard, pycore monitor) sees the same set.
        $grouped = GlobalTask::query()
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');

        $count = static function (string $status) use ($grouped): int {
            return (int) ($grouped[$status] ?? 0);
        };

        return [
            'total' => (int) $grouped->sum(),
            'pending' => $count(GlobalTask::STATUS_PENDING),
            'assigned' => $count(GlobalTask::STATUS_ASSIGNED),
            'processing' => $count(GlobalTask::STATUS_PROCESSING),
            'completed' => $count(GlobalTask::STATUS_COMPLETED),
            'completed_demo' => $count(GlobalTask::STATUS_COMPLETED_DEMO),
            'failed' => $count(GlobalTask::STATUS_FAILED),
            'cancelled' => $count(GlobalTask::STATUS_CANCELLED),
        ];
    }

    /**
     * Process task result within transaction (extensible processing)
     *
     * @param GlobalTask $task Task model (already locked)
     * @param array $result Result data
     * @param bool $isDemoMode Demo mode flag
     * @return void
     */
    protected function processTaskResultInTransaction(GlobalTask $task, array $result, bool $isDemoMode): void
    {
        if (empty($result)) {
            return;
        }

        $registry = $this->getProcessorRegistry();
        $processed = $registry->process($task, $result, $isDemoMode);

        if (!$processed) {
            Log::debug('[TaskManager] No processor found for task', [
                'task_id' => $task->task_id,
                'app_name' => $task->app_name,
                'task_type' => $task->task_type,
            ]);
        }
    }
}
