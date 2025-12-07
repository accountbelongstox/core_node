<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TaskController extends Controller
{
    protected $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    /**
     * Create a new task
     *
     * POST /api/task/create
     */
    public function create(Request $request)
    {
        try {
            $validated = $request->validate([
                'app_name' => 'required|string',
                'task_type' => 'required|string',
                'execution_type' => 'required|string|in:local_timer,remote_compute,remote_ocr,remote_translation,remote_video,remote_io',
                'payload' => 'nullable|array',
                'timeout_seconds' => 'nullable|integer|min:10|max:3600',
                'priority' => 'nullable|integer|min:0|max:100',
                'max_retries' => 'nullable|integer|min:0|max:10',
            ]);

            $task = $this->taskManager->createTask(
                $validated['app_name'],
                $validated['task_type'],
                $validated['execution_type'],
                $validated['payload'] ?? [],
                $validated['timeout_seconds'] ?? 120,
                $validated['priority'] ?? 0,
                $validated['max_retries'] ?? 3
            );

            return response()->json([
                'success' => true,
                'task_id' => $task->task_id,
                'message' => 'Task created successfully',
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Exception $e) {
            Log::error('Failed to create task', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to create task: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get task status
     *
     * GET /api/task/{taskId}/status
     */
    public function status(string $taskId)
    {
        try {
            $task = GlobalTask::where('task_id', $taskId)->first();

            if (!$task) {
                return response()->json([
                    'success' => false,
                    'message' => 'Task not found',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'task' => [
                    'task_id' => $task->task_id,
                    'app_name' => $task->app_name,
                    'task_type' => $task->task_type,
                    'execution_type' => $task->execution_type,
                    'status' => $task->status,
                    'progress' => $task->progress,
                    'assigned_to' => $task->assigned_to,
                    'result' => $task->result,
                    'error' => $task->error,
                    'created_at' => $task->created_at?->toISOString(),
                    'updated_at' => $task->updated_at?->toISOString(),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get task status', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get task status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * List tasks with filters
     *
     * GET /api/task/list
     */
    public function list(Request $request)
    {
        try {
            $query = GlobalTask::query();

            // Apply filters
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('app_name')) {
                $query->where('app_name', $request->app_name);
            }

            if ($request->has('execution_type')) {
                $query->where('execution_type', $request->execution_type);
            }

            // Pagination
            $limit = $request->input('limit', 20);
            $offset = $request->input('offset', 0);

            $total = $query->count();
            $tasks = $query->orderBy('created_at', 'desc')
                ->skip($offset)
                ->take($limit)
                ->get();

            return response()->json([
                'success' => true,
                'total' => $total,
                'count' => $tasks->count(),
                'tasks' => $tasks->map(function ($task) {
                    return [
                        'task_id' => $task->task_id,
                        'app_name' => $task->app_name,
                        'task_type' => $task->task_type,
                        'execution_type' => $task->execution_type,
                        'status' => $task->status,
                        'progress' => $task->progress,
                        'assigned_to' => $task->assigned_to,
                        'created_at' => $task->created_at?->toISOString(),
                    ];
                }),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to list tasks', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to list tasks: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get task statistics
     *
     * GET /api/task/stats
     */
    public function stats()
    {
        try {
            $stats = $this->taskManager->getTaskStats();

            return response()->json([
                'success' => true,
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get task stats', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get task stats: ' . $e->getMessage(),
            ], 500);
        }
    }
}
