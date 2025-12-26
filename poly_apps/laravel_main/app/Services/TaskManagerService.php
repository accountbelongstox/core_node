<?php

namespace App\Services;

use App\Models\GlobalTask;
use App\Models\Worker;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\ConnectionInterface;
use App\Services\TaskProcessors\TaskProcessorRegistry;
use App\Services\TaskProcessors\DictionaryTaskProcessor;

class TaskManagerService
{
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

    /**
     * Pull tasks for a worker (smart allocation)
     *
     * @deprecated Use pullAndAssignTasksForWorker() instead for atomic operation
     * @internal This method is UNSAFE - does not assign tasks atomically
     *
     * @param string $workerId Worker ID
     * @param int $limit Maximum number of tasks to return
     * @return array Array of tasks
     */
    public function pullTasksForWorker(string $workerId, int $limit = 5): array
    {
        // Get worker to check processor types
        $worker = Worker::where('worker_id', $workerId)->first();
        if (!$worker) {
            throw new \Exception("Worker not found: $workerId");
        }

        // Get pending tasks that match worker's processor types
        $tasks = [];
        foreach ($worker->processor_types as $processorType) {
            $availableTasks = GlobalTask::pending()
                ->where('execution_type', $processorType)
                ->orderBy('priority', 'desc')
                ->orderBy('created_at', 'asc')
                ->limit($limit - count($tasks))
                ->get();

            foreach ($availableTasks as $task) {
                $tasks[] = $task;
                if (count($tasks) >= $limit) {
                    break 2;
                }
            }
        }

        Log::info('Tasks pulled', [
            'worker_id' => $workerId,
            'count' => count($tasks),
        ]);

        return $tasks;
    }

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
        // Use single transaction for all operations
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
        });

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

            // Get worker
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                throw new \Exception("Worker not found: $workerId");
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
        });

        return $success;
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
            // Lock and reload task
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                throw new \Exception("Task not found: $taskId");
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

            // Get worker
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                throw new \Exception("Worker not found: $workerId");
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
                $task->save();

                Log::debug('Task progress updated', [
                    'task_id' => $taskId,
                    'progress' => $progress,
                ]);
            }

            return true;
        });

        return $success;
    }

    /**
     * Release timed out tasks (called by OctaneTimer)
     *
     * @return int Number of tasks released
     */
    public function releaseTimedOutTasks(): int
    {
        $tasks = GlobalTask::timedOut()->get();
        $count = 0;

        foreach ($tasks as $task) {
            $workerId = $task->assigned_to;
            $task->releaseAssignment();

            // Update worker status
            if ($workerId) {
                $worker = Worker::where('worker_id', $workerId)->first();
                if ($worker) {
                    $worker->releaseTask();
                }
            }

            $count++;
            Log::warning('Task timed out and released', [
                'task_id' => $task->task_id,
                'worker_id' => $workerId,
            ]);
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
        return [
            'total' => GlobalTask::count(),
            'pending' => GlobalTask::where('status', GlobalTask::STATUS_PENDING)->count(),
            'assigned' => GlobalTask::where('status', GlobalTask::STATUS_ASSIGNED)->count(),
            'processing' => GlobalTask::where('status', GlobalTask::STATUS_PROCESSING)->count(),
            'completed' => GlobalTask::where('status', GlobalTask::STATUS_COMPLETED)->count(),
            'completed_demo' => GlobalTask::where('status', GlobalTask::STATUS_COMPLETED_DEMO)->count(),
            'failed' => GlobalTask::where('status', GlobalTask::STATUS_FAILED)->count(),
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
