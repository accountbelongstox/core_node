<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Models\GlobalTaskEvent;
use App\Services\QueueCenter\QueueCenterService;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
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
    protected QueueCenterService $queueCenter;

    public function __construct(TaskManagerService $taskManager, QueueCenterService $queueCenter)
    {
        $this->taskManager = $taskManager;
        $this->queueCenter = $queueCenter;
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
            // Task type, lane, capability, and ordering rules come from the
            // shared JSON model. Audio queues use queue_position, not priority.
            'task_type' => ['required', 'string', Rule::in(QueueCenterContract::taskTypeKeys())],
            // Accepted only for old callers; TaskManagerService persists the
            // lane from task_type's central definition and ignores this hint.
            'execution_type' => ['nullable', 'string', Rule::in(GlobalTask::executionTypes())],
            'payload' => 'nullable|array',
            'timeout_seconds' => 'nullable|integer|min:10|max:3600',
            'priority' => 'nullable|integer|min:0|max:' . GlobalTask::priority('maximum'),
            'max_retries' => 'nullable|integer|min:0|max:10',
            // Fast lane: capability narrows which client may claim an interactive
            // task (NULL = either); interactive=true promotes it onto remote_fast
            // at the FAST priority tier.
            'capability' => ['nullable', 'string', Rule::in(GlobalTask::capabilities())],
            'interactive' => 'nullable|boolean',
        ]);

        $payload = [];
        if (isset($validated['payload'])) {
            $payload = $validated['payload'];
        }

        $timeoutSeconds = 120;
        if (isset($validated['timeout_seconds'])) {
            $timeoutSeconds = $validated['timeout_seconds'];
        }

        $priority = GlobalTask::priority('default');
        if (isset($validated['priority'])) {
            $priority = $validated['priority'];
        }

        $maxRetries = 3;
        if (isset($validated['max_retries'])) {
            $maxRetries = $validated['max_retries'];
        }

        $interactive = (bool) ($validated['interactive'] ?? false);
        $capability = $validated['capability'] ?? null;
        $executionType = QueueCenterContract::taskTypeExecution($validated['task_type']);

        $task = $this->taskManager->createTask(
            $validated['app_name'],
            $validated['task_type'],
            (string) $executionType,
            $payload,
            $timeoutSeconds,
            $priority,
            $maxRetries,
            $interactive,
            $capability
        );

        return $this->success(
            QueueCenterContract::projectTask($task, 'create_result'),
            'Task created successfully'
        );
    }

    /**
     * Get task status
     *
     * GET /api/task/{taskId}/status
     */
    public function status(string $taskId): JsonResponse
    {
        $task = GlobalTask::findByTaskId($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success([
            'task' => QueueCenterContract::projectTask($task, 'status'),
        ], 'Task status retrieved successfully');
    }

    /**
     * Move a task to the front of its queue ("jump to task-top").
     *
     * POST /api/task/{taskId}/bump   body: { priority?: int (default PRIORITY_FAST) }
     *
     * Ordering is resolved from the task type's central contract: queue-
     * position-ordered (audio) tasks ignore any numeric priority and move by
     * head ticket only; priority-ordered tasks keep the numeric bump.
     *
     * 200 + new ordering state on success; 404 unknown task; 409 if the task
     * is no longer pending (assigned/processing/terminal cannot be reordered).
     * Control-plane endpoint (no auth, same as the rest of this group).
     */
    public function bump(string $taskId, Request $request): JsonResponse
    {
        $task = GlobalTask::findByTaskId($taskId);
        if (!$task) {
            return $this->notFound('Task not found');
        }

        if (QueueCenterContract::isQueuePositionOrdered((string) $task->task_type)) {
            $head = $this->queueCenter->moveExistingTaskToHead($taskId);
            if (($head['status'] ?? null) !== 'moved_to_head') {
                return $this->error('Task is not pending and cannot be moved to the queue head', 409);
            }
            $task = $head['task'] instanceof GlobalTask ? $head['task'] : $task;

            return $this->success([
                'task_id' => $taskId,
                'queue_position' => (int) $task->queue_position,
                'status' => $task->status,
            ], 'Task moved to queue head');
        }

        $validated = $request->validate([
            'priority' => 'nullable|integer|min:0|max:' . GlobalTask::priority('maximum'),
        ]);
        $priority = (int) ($validated['priority'] ?? GlobalTask::priority('fast'));
        $outcome = $this->taskManager->bumpTaskPriority($taskId, $priority);

        if ($outcome === 'not_found') {
            return $this->notFound('Task not found');
        }
        if ($outcome === 'not_pending') {
            return $this->error('Task is not pending and cannot be bumped', 409);
        }

        $task = GlobalTask::findByTaskId($taskId);

        return $this->success([
            'task_id' => $taskId,
            'priority' => $task ? (int) $task->priority : $priority,
            'status' => $task ? $task->status : null,
        ], 'Task priority bumped');
    }

    /**
     * Per-task detail aggregate (the data backbone for the live drilldown UI).
     *
     * GET /api/task/{taskId}/detail
     *
     * Joins the GlobalTask row with its append-only GlobalTaskEvent transition
     * timeline (already surfaced nowhere else) plus derived phase/metadata.
     */
    public function detail(string $taskId): JsonResponse
    {
        $task = GlobalTask::findByTaskId($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success(
            $this->taskDetailData($task),
            'Task detail retrieved successfully'
        );
    }

    /**
     * Build the canonical detail payload consumed by the detail endpoint and
     * realtime-triggered refreshes, so the UI sees one shape.
     *
     * @return array<string,mixed>
     */
    protected function taskDetailData(GlobalTask $task): array
    {
        // Bound the snapshot to the central event_batch limit (the stream tail
        // uses the same value) so a long-lived task cannot load an unbounded
        // timeline. Fetch newest-first, then reverse for chronological UI order.
        $events = GlobalTaskEvent::recentForTask(
            $task->task_id,
            QueueCenterContract::taskLimit('event_batch')
        )
            ->map(static fn ($event): array => QueueCenterContract::projectTask($event, 'event'))
            ->all();

        // Derived current phase: for an in-flight task, how long it has been in
        // the hands of its assigned worker.
        $elapsed = null;
        if ($task->assigned_at && in_array($task->status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)) {
            // Carbon 3 diffInSeconds returns a float — cast to int so the wire
            // shape stays an integer second count.
            $elapsed = (int) max(0, now()->diffInSeconds($task->assigned_at, false) * -1);
        }

        $timeoutIn = null;
        if ($task->timeout_at && in_array($task->status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)) {
            $timeoutIn = (int) max(0, now()->diffInSeconds($task->timeout_at, false));
        }

        $currentPhase = QueueCenterContract::projectTask([
            'phase' => $task->status,
            'worker_id' => $task->assigned_to,
            'elapsed_seconds' => $elapsed,
        ], 'current_phase');
        $metadata = QueueCenterContract::projectTask([
            'total_attempts' => (int) $task->retry_count,
            'max_retries' => (int) $task->max_retries,
            'will_retry' => $task->canRetry(),
            'estimated_timeout_in_seconds' => $timeoutIn,
        ], 'detail_metadata');

        return QueueCenterContract::projectTask([
            'task' => QueueCenterContract::projectTask($task, 'detail'),
            'events' => $events,
            'current_phase' => $currentPhase,
            'metadata' => $metadata,
        ], 'detail_bundle');
    }

    /**
     * List tasks with filters
     *
     * GET /api/task/list
     */
    public function list(Request $request): JsonResponse
    {
        $listLimit = QueueCenterContract::taskLimit('list');
        $limit = QueueCenterContract::taskLimit('list_default');
        if ($request->has('limit')) {
            // Validate + clamp: an unclamped limit could dump the whole table on a
            // single request. The cap is shared with both direct task UIs.
            $limit = (int) $request->input('limit');
            if ($limit < 1) {
                $limit = 1;
            } elseif ($limit > $listLimit) {
                $limit = $listLimit;
            }
        }

        $offset = 0;
        if ($request->has('offset')) {
            $offset = (int) $request->input('offset');
            if ($offset < 0) {
                $offset = 0;
            }
        }

        $filters = array_filter(
            $request->only(['status', 'app_name', 'execution_type']),
            static fn ($value): bool => $value !== null && $value !== ''
        );

        return $this->success(
            $this->taskManager->getTaskListSnapshot($filters, $limit, $offset),
            'Tasks list retrieved successfully'
        );
    }

    /**
     * Cancel a task
     *
     * POST /api/task/{taskId}/cancel
     *
     * Pending tasks cancel directly; assigned/processing tasks are revoked
     * from their worker (its late result is rejected by the ownership check).
     * Terminal tasks (completed/failed/cancelled) are not cancellable.
     */
    public function cancel(string $taskId): JsonResponse
    {
        $outcome = $this->taskManager->cancelTask($taskId);

        if ($outcome === 'not_found') {
            return $this->notFound('Task not found');
        }

        if ($outcome === 'not_cancellable') {
            return $this->error('Task already finished — cannot cancel', 409);
        }

        return $this->success([
            'task_id' => $taskId,
            'status' => GlobalTask::status('cancelled'),
        ], 'Task cancelled');
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
        $deletedCount = GlobalTask::deleteInvalidPayloadTasks();

        return $this->success([
            'deleted_count' => $deletedCount
        ], 'Invalid tasks cleaned successfully');
    }

    /**
     * Reset assigned (and optionally processing) tasks back to pending.
     *
     * POST /api/task/reset-assigned
     *
     * Body: { "include_processing": bool }  — when true, also resets tasks in
     * the `processing` status (a worker that reported intermediate progress then
     * died leaves its task in this state; the timed-out reclaim normally catches
     * them, but this is the manual escape hatch when timeout_at is NULL).
     * Default: false — only resets `assigned`.
     */
    public function resetAssigned(Request $request): JsonResponse
    {
        $includeProcessing = (bool) $request->input('include_processing', false);
        $statuses = [GlobalTask::status('assigned')];
        if ($includeProcessing) {
            $statuses[] = GlobalTask::status('processing');
        }

        $updatedCount = GlobalTask::resetStatusesToPending($statuses);

        return $this->success([
            'reset_count' => $updatedCount,
            'include_processing' => $includeProcessing,
        ], 'Assigned tasks reset successfully');
    }
}
