<?php

namespace App\Services;

use App\Models\GlobalTask;
use App\Models\Worker;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Events\TaskAssignedEvent;
use App\Events\TaskProgressEvent;
use App\Events\TaskCompletedEvent;
use App\Events\TaskFailedEvent;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;

class TaskManagerService
{
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
        $worker = Worker::where('worker_id', $workerId)->first();
        if (!$worker) {
            throw new \Exception("Worker not found: $workerId");
        }

        $assignedTasks = [];

        foreach ($worker->processor_types as $processorType) {
            if (count($assignedTasks) >= $limit) {
                break;
            }

            DB::transaction(function () use ($processorType, $workerId, $limit, &$assignedTasks, $worker) {
                $availableTasks = GlobalTask::pending()
                    ->where('execution_type', $processorType)
                    ->orderBy('priority', 'desc')
                    ->orderBy('created_at', 'asc')
                    ->limit($limit - count($assignedTasks))
                    ->lockForUpdate()
                    ->get();

                foreach ($availableTasks as $task) {
                    $task->assignTo($workerId, $task->timeout_seconds);
                    $worker->assignTask($task->task_id);
                    $assignedTasks[] = $task;

                    if (count($assignedTasks) >= $limit) {
                        break;
                    }
                }
            });
        }

        Log::info('Tasks pulled and assigned atomically', [
            'worker_id' => $workerId,
            'count' => count($assignedTasks),
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

        $success = DB::transaction(function () use ($taskId, $workerId, &$taskData) {
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

        if ($success && $taskData) {
            broadcast(new TaskAssignedEvent(
                $taskData['worker_id'],
                $taskData['task_id'],
                $taskData['task_type'],
                $taskData['payload'],
                $taskData['timeout_seconds'],
                $taskData['priority']
            ));
        }

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
        $broadcastEvent = null;

        $success = DB::transaction(function () use ($taskId, $workerId, $status, $progress, $result, $error, &$broadcastEvent) {
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
                $isDemoMode = false;
                if (isset($result['is_demo_mode'])) {
                    // Frontend decides demo mode
                    $isDemoMode = $result['is_demo_mode'];
                } elseif (isset($task->payload['is_demo_mode'])) {
                    // Fallback to task payload (backward compatibility)
                    $isDemoMode = $task->payload['is_demo_mode'];
                }

                if ($isDemoMode) {
                    $task->status = GlobalTask::STATUS_COMPLETED_DEMO;
                    $task->progress = 100.0;

                    $taskResult = [];
                    if ($result) {
                        $taskResult = $result;
                    }
                    $task->result = $taskResult;
                    $task->save();
                } else {
                    $completeResult = [];
                    if ($result) {
                        $completeResult = $result;
                    }
                    $task->complete($completeResult);
                }

                $worker->incrementCompleted();
                $worker->releaseTask();

                Log::info('Task completed', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'demo_mode' => $isDemoMode,
                ]);

                $broadcastEvent = new TaskCompletedEvent($taskId, $result, $workerId);
            } elseif ($status === 'failed') {
                $failError = 'Unknown error';
                if ($error) {
                    $failError = $error;
                }
                $task->fail($failError);
                $worker->incrementFailed();
                $worker->releaseTask();

                // Retry if possible
                if ($task->canRetry()) {
                    $task->releaseAssignment();
                    Log::info('Task failed, will retry', [
                        'task_id' => $taskId,
                        'retry_count' => $task->retry_count,
                        'max_retries' => $task->max_retries,
                    ]);
                    $broadcastEvent = new TaskFailedEvent($taskId, $error, $workerId, true);
                } else {
                    Log::error('Task failed permanently', [
                        'task_id' => $taskId,
                        'error' => $error,
                    ]);
                    $broadcastEvent = new TaskFailedEvent($taskId, $error, $workerId, false);
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

                $broadcastEvent = new TaskProgressEvent($taskId, $progress, $status);
            }

            return true;
        });

        if ($success && $broadcastEvent) {
            broadcast($broadcastEvent);
        }

        if ($success && $status === 'completed') {
            $this->processTaskResult($taskId, $result);
        }

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
        $workers = Worker::where('last_heartbeat_at', '<', now()->subSeconds(Worker::HEARTBEAT_TIMEOUT))
            ->whereNotNull('last_heartbeat_at')
            ->where('status', '!=', Worker::STATUS_OFFLINE)
            ->get();

        $count = 0;

        foreach ($workers as $worker) {
            // Release any assigned tasks
            if ($worker->current_task_id) {
                $task = GlobalTask::where('task_id', $worker->current_task_id)->first();
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
            'failed' => GlobalTask::where('status', GlobalTask::STATUS_FAILED)->count(),
        ];
    }

    /**
     * Process task result after completion (callback for app-specific processing)
     *
     * @param string $taskId Task ID
     * @param array|null $result Result data
     * @return void
     */
    protected function processTaskResult(string $taskId, ?array $result): void
    {
        $task = GlobalTask::where('task_id', $taskId)->first();
        if (!$task) {
            return;
        }
        if (!$result) {
            return;
        }

        $appName = $task->app_name;
        $taskType = $task->task_type;

        $isDemoMode = false;
        if (isset($task->payload['is_demo_mode'])) {
            $isDemoMode = $task->payload['is_demo_mode'];
        }

        if ($appName === 'AppQyV1' && in_array($taskType, ['dictionary_explanation', 'dictionary_explanation_demo'])) {
            $language = 'english';
            if (isset($task->payload['language'])) {
                $language = $task->payload['language'];
            }

            $explanations = [];
            if (isset($result['explanations'])) {
                $explanations = $result['explanations'];
            }

            if (!empty($explanations)) {
                $translationService = new AppQyV1TranslationTaskService($this);
                $translationService->processExplanationResult(
                    $taskId,
                    $language,
                    $explanations,
                    $isDemoMode
                );

                Log::info('[TaskManager] Dictionary explanation result processed', [
                    'task_id' => $taskId,
                    'explanation_count' => count($explanations),
                    'demo_mode' => $isDemoMode,
                ]);
            }
        }
    }
}
