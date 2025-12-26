<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;

/**
 * Task Controller
 * Uses standardized ApiResponse trait
 * NO try-catch blocks - trust Laravel validation and database operations
 */
class TaskController extends Controller
{
    use ApiResponse;

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
    public function create(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'app_name' => 'required|string',
            'task_type' => 'required|string',
            'execution_type' => 'required|string|in:local_timer,remote_client,remote_compute,remote_ocr,remote_translation,remote_video,remote_io',
            'payload' => 'nullable|array',
            'timeout_seconds' => 'nullable|integer|min:10|max:3600',
            'priority' => 'nullable|integer|min:0|max:100',
            'max_retries' => 'nullable|integer|min:0|max:10',
        ]);

        $payload = [];
        if (isset($validated['payload'])) {
            $payload = $validated['payload'];
        }

        $timeoutSeconds = 120;
        if (isset($validated['timeout_seconds'])) {
            $timeoutSeconds = $validated['timeout_seconds'];
        }

        $priority = 0;
        if (isset($validated['priority'])) {
            $priority = $validated['priority'];
        }

        $maxRetries = 3;
        if (isset($validated['max_retries'])) {
            $maxRetries = $validated['max_retries'];
        }

        $task = $this->taskManager->createTask(
            $validated['app_name'],
            $validated['task_type'],
            $validated['execution_type'],
            $payload,
            $timeoutSeconds,
            $priority,
            $maxRetries
        );

        return $this->success([
            'task_id' => $task->task_id
        ], 'Task created successfully');
    }

    /**
     * Get task status
     *
     * GET /api/task/{taskId}/status
     */
    public function status(string $taskId): JsonResponse
    {
        $task = GlobalTask::where('task_id', $taskId)->first();

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $createdAt = null;
        if ($task->created_at) {
            $createdAt = $task->created_at->toISOString();
        }

        $updatedAt = null;
        if ($task->updated_at) {
            $updatedAt = $task->updated_at->toISOString();
        }

        return $this->success([
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
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ],
        ], 'Task status retrieved successfully');
    }

    /**
     * List tasks with filters
     *
     * GET /api/task/list
     */
    public function list(Request $request): JsonResponse
    {
        $query = GlobalTask::query();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('app_name')) {
            $query->where('app_name', $request->app_name);
        }

        if ($request->has('execution_type')) {
            $query->where('execution_type', $request->execution_type);
        }

        $limit = 20;
        if ($request->has('limit')) {
            $limit = $request->input('limit');
        }

        $offset = 0;
        if ($request->has('offset')) {
            $offset = $request->input('offset');
        }

        $total = $query->count();
        $tasks = $query->orderBy('created_at', 'desc')
            ->skip($offset)
            ->take($limit)
            ->get();

        return $this->success([
            'total' => $total,
            'count' => $tasks->count(),
            'tasks' => $tasks->map(function ($task) {
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
                    'progress' => $task->progress,
                    'assigned_to' => $task->assigned_to,
                    'created_at' => $createdAt,
                ];
            }),
        ], 'Tasks list retrieved successfully');
    }

    /**
     * Get task statistics
     *
     * GET /api/task/stats
     */
    public function stats(): JsonResponse
    {
        $stats = $this->taskManager->getTaskStats();

        return $this->success(['stats' => $stats], 'Task stats retrieved successfully');
    }

    /**
     * Clean invalid tasks (tasks with null payload)
     *
     * POST /api/task/clean-invalid
     */
    public function cleanInvalid(): JsonResponse
    {
        $deletedCount = GlobalTask::whereNull('payload')->delete();

        return $this->success([
            'deleted_count' => $deletedCount
        ], 'Invalid tasks cleaned successfully');
    }

    /**
     * Reset all assigned tasks back to pending
     *
     * POST /api/task/reset-assigned
     */
    public function resetAssigned(): JsonResponse
    {
        $updatedCount = GlobalTask::where('status', GlobalTask::STATUS_ASSIGNED)
            ->update([
                'status' => GlobalTask::STATUS_PENDING,
                'assigned_to' => null,
                'assigned_at' => null,
                'timeout_at' => null,
            ]);

        return $this->success([
            'reset_count' => $updatedCount
        ], 'Assigned tasks reset successfully');
    }
}
