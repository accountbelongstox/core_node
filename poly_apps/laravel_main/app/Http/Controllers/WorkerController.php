<?php

namespace App\Http\Controllers;

use App\Services\TaskManagerService;
use App\Services\WorkerManagerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WorkerController extends Controller
{
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
    public function register(Request $request)
    {
        try {
            $validated = $request->validate([
                'worker_id' => 'required|string',
                'worker_name' => 'required|string',
                'processor_types' => 'required|array',
                'processor_types.*' => 'string|in:remote_compute,remote_ocr,remote_translation,remote_video,remote_io',
                'hostname' => 'nullable|string',
                'platform' => 'nullable|string',
                'metadata' => 'nullable|array',
            ]);

            $worker = $this->workerManager->register(
                $validated['worker_id'],
                $validated['worker_name'],
                $validated['processor_types'],
                $validated['hostname'] ?? null,
                $validated['platform'] ?? null,
                $validated['metadata'] ?? []
            );

            return response()->json([
                'success' => true,
                'worker_id' => $worker->worker_id,
                'message' => 'Worker registered successfully',
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Exception $e) {
            Log::error('Failed to register worker', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to register worker: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Worker heartbeat
     *
     * POST /api/worker/heartbeat
     */
    public function heartbeat(Request $request)
    {
        try {
            $validated = $request->validate([
                'worker_id' => 'required|string',
            ]);

            $success = $this->workerManager->heartbeat($validated['worker_id']);

            if (!$success) {
                return response()->json([
                    'success' => false,
                    'message' => 'Worker not found',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Heartbeat received',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to process heartbeat', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to process heartbeat: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Pull tasks for worker (long polling)
     *
     * GET /api/worker/tasks/pull
     */
    public function pullTasks(Request $request)
    {
        try {
            $validated = $request->validate([
                'worker_id' => 'required|string',
                'limit' => 'nullable|integer|min:1|max:50',
                'timeout' => 'nullable|integer|min:1|max:30',
            ]);

            $workerId = $validated['worker_id'];
            $limit = $validated['limit'] ?? 5;
            $timeout = $validated['timeout'] ?? 30;

            // Long polling: wait for tasks with timeout
            $startTime = time();
            $tasks = [];

            while (time() - $startTime < $timeout) {
                $tasks = $this->taskManager->pullTasksForWorker($workerId, $limit);

                if (!empty($tasks)) {
                    break;
                }

                // Wait 1 second before checking again
                sleep(1);
            }

            return response()->json([
                'success' => true,
                'count' => count($tasks),
                'tasks' => array_map(function ($task) {
                    return [
                        'task_id' => $task->task_id,
                        'app_name' => $task->app_name,
                        'task_type' => $task->task_type,
                        'execution_type' => $task->execution_type,
                        'status' => $task->status,
                        'payload' => $task->payload,
                        'timeout_seconds' => $task->timeout_seconds,
                        'priority' => $task->priority,
                        'created_at' => $task->created_at?->toISOString(),
                    ];
                }, $tasks),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to pull tasks', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to pull tasks: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Accept a task
     *
     * POST /api/worker/tasks/accept
     */
    public function acceptTask(Request $request)
    {
        try {
            $validated = $request->validate([
                'task_id' => 'required|string',
                'worker_id' => 'required|string',
            ]);

            $success = $this->taskManager->assignTask(
                $validated['task_id'],
                $validated['worker_id']
            );

            if (!$success) {
                return response()->json([
                    'success' => false,
                    'message' => 'Task already assigned or not available',
                ], 409);
            }

            return response()->json([
                'success' => true,
                'message' => 'Task accepted',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to accept task', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to accept task: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Submit task result
     *
     * POST /api/worker/tasks/result
     */
    public function submitResult(Request $request)
    {
        try {
            $validated = $request->validate([
                'task_id' => 'required|string',
                'worker_id' => 'required|string',
                'status' => 'required|string|in:processing,completed,failed',
                'progress' => 'nullable|numeric|min:0|max:100',
                'result' => 'nullable|array',
                'error' => 'nullable|string',
            ]);

            $success = $this->taskManager->submitResult(
                $validated['task_id'],
                $validated['worker_id'],
                $validated['status'],
                $validated['progress'] ?? 0,
                $validated['result'] ?? null,
                $validated['error'] ?? null
            );

            if (!$success) {
                return response()->json([
                    'success' => false,
                    'message' => 'Worker not assigned to this task or task was reassigned',
                ], 409);
            }

            return response()->json([
                'success' => true,
                'message' => 'Result submitted',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to submit result', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to submit result: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * List all workers
     *
     * GET /api/worker/list
     */
    public function list()
    {
        try {
            $workers = $this->workerManager->getAllWorkers();

            return response()->json([
                'success' => true,
                'count' => $workers->count(),
                'workers' => $workers->map(function ($worker) {
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
                        'last_heartbeat_at' => $worker->last_heartbeat_at?->toISOString(),
                        'created_at' => $worker->created_at?->toISOString(),
                    ];
                }),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to list workers', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to list workers: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get worker statistics
     *
     * GET /api/worker/stats
     */
    public function stats()
    {
        try {
            $stats = $this->workerManager->getWorkerStats();

            return response()->json([
                'success' => true,
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get worker stats', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get worker stats: ' . $e->getMessage(),
            ], 500);
        }
    }
}
