<?php

namespace App\Http\Controllers;

use App\Services\TaskManagerService;
use App\Services\WorkerManagerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;

/**
 * Worker Controller
 * Uses standardized ApiResponse trait
 * NO try-catch blocks - trust Laravel validation and database operations
 */
class WorkerController extends Controller
{
    use ApiResponse;

    protected $workerManager;
    protected $taskManager;

    public function __construct(WorkerManagerService $workerManager, TaskManagerService $taskManager)
    {
        $this->workerManager = $workerManager;
        $this->taskManager = $taskManager;
    }

    /**
     * Register a worker
     *
     * POST /api/worker/register
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string',
            'worker_name' => 'required|string',
            'processor_types' => 'required|array',
            'processor_types.*' => 'string|in:remote_compute,remote_ocr,remote_translation,remote_video,remote_io,remote_client',
            'hostname' => 'nullable|string',
            'platform' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $hostname = null;
        if (isset($validated['hostname'])) {
            $hostname = $validated['hostname'];
        }

        $platform = null;
        if (isset($validated['platform'])) {
            $platform = $validated['platform'];
        }

        $metadata = [];
        if (isset($validated['metadata'])) {
            $metadata = $validated['metadata'];
        }

        $worker = $this->workerManager->register(
            $validated['worker_id'],
            $validated['worker_name'],
            $validated['processor_types'],
            $hostname,
            $platform,
            $metadata
        );

        return $this->success([
            'worker_id' => $worker->worker_id
        ], 'Worker registered successfully');
    }

    /**
     * Worker heartbeat
     *
     * POST /api/worker/heartbeat
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string',
        ]);

        $success = $this->workerManager->heartbeat($validated['worker_id']);

        if (!$success) {
            return $this->notFound('Worker not found');
        }

        return $this->success(null, 'Heartbeat received');
    }

    /**
     * Pull tasks for worker (long polling)
     * Tasks are automatically assigned to worker atomically
     *
     * GET /api/worker/tasks/pull
     */
    public function pullTasks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string',
            'limit' => 'nullable|integer|min:1|max:50',
            'timeout' => 'nullable|integer|min:1|max:30',
        ]);

        $workerId = $validated['worker_id'];

        $limit = 5;
        if (isset($validated['limit'])) {
            $limit = $validated['limit'];
        }

        $timeout = 30;
        if (isset($validated['timeout'])) {
            $timeout = $validated['timeout'];
        }

        $startTime = time();
        $tasks = [];

        while (time() - $startTime < $timeout) {
            $tasks = $this->taskManager->pullAndAssignTasksForWorker($workerId, $limit);

            if (!empty($tasks)) {
                break;
            }

            sleep(1);
        }

        return $this->success([
            'count' => count($tasks),
            'tasks' => array_map(function ($task) {
                $createdAt = null;
                if ($task->created_at) {
                    $createdAt = $task->created_at->toISOString();
                }

                return [
                    'task_id' => $task->task_id,
                    'app_name' => $task->app_name,
                    'task_type' => $task->task_type,
                    'execution_type' => $task->execution_type,
                    'status' => $task->status,
                    'payload' => $task->payload,
                    'timeout_seconds' => $task->timeout_seconds,
                    'priority' => $task->priority,
                    'created_at' => $createdAt,
                ];
            }, $tasks),
        ], 'Tasks pulled and assigned successfully');
    }

    /**
     * Accept a task
     *
     * POST /api/worker/tasks/accept
     */
    public function acceptTask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_id' => 'required|string',
            'worker_id' => 'required|string',
        ]);

        $success = $this->taskManager->assignTask(
            $validated['task_id'],
            $validated['worker_id']
        );

        if (!$success) {
            return $this->error('Task already assigned or not available', 409);
        }

        return $this->success(null, 'Task accepted');
    }

    /**
     * Submit task result
     *
     * POST /api/worker/tasks/result
     */
    public function submitResult(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_id' => 'required|string',
            'worker_id' => 'required|string',
            'status' => 'required|string|in:processing,completed,failed',
            'progress' => 'nullable|numeric|min:0|max:100',
            'result' => 'nullable|array',
            'error' => 'nullable|string',
        ]);

        $progress = 0;
        if (isset($validated['progress'])) {
            $progress = $validated['progress'];
        }

        $result = null;
        if (isset($validated['result'])) {
            $result = $validated['result'];
        }

        $error = null;
        if (isset($validated['error'])) {
            $error = $validated['error'];
        }

        $success = $this->taskManager->submitResult(
            $validated['task_id'],
            $validated['worker_id'],
            $validated['status'],
            $progress,
            $result,
            $error
        );

        if (!$success) {
            return $this->error('Worker not assigned to this task or task was reassigned', 409);
        }

        return $this->success(null, 'Result submitted');
    }

    /**
     * List all workers
     *
     * GET /api/worker/list
     */
    public function list(): JsonResponse
    {
        $workers = $this->workerManager->getAllWorkers();

        return $this->success([
            'count' => $workers->count(),
            'workers' => $workers->map(function ($worker) {
                $lastHeartbeatAt = null;
                if ($worker->last_heartbeat_at) {
                    $lastHeartbeatAt = $worker->last_heartbeat_at->toISOString();
                }

                $createdAt = null;
                if ($worker->created_at) {
                    $createdAt = $worker->created_at->toISOString();
                }

                return [
                    'worker_id' => $worker->worker_id,
                    'worker_name' => $worker->worker_name,
                    'processor_types' => $worker->processor_types,
                    'status' => $worker->status,
                    'hostname' => $worker->hostname,
                    'platform' => $worker->platform,
                    'completed_tasks' => $worker->completed_tasks,
                    'failed_tasks' => $worker->failed_tasks,
                    'current_task_id' => $worker->current_task_id,
                    'last_heartbeat_at' => $lastHeartbeatAt,
                    'created_at' => $createdAt,
                ];
            }),
        ], 'Workers list retrieved successfully');
    }

    /**
     * Get worker statistics
     *
     * GET /api/worker/stats
     */
    public function stats(): JsonResponse
    {
        $stats = $this->workerManager->getWorkerStats();

        return $this->success(['stats' => $stats], 'Worker stats retrieved successfully');
    }
}
