<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Models\GlobalTaskEvent;
use App\Services\TaskManagerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\StreamedEvent;
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
            // Derived from the model's canonical EXECUTION_TYPES so new lanes are
            // accepted automatically and this rule can never drift from the model.
            'execution_type' => ['required', 'string', Rule::in(GlobalTask::EXECUTION_TYPES)],
            'payload' => 'nullable|array',
            'timeout_seconds' => 'nullable|integer|min:10|max:3600',
            'priority' => 'nullable|integer|min:0|max:100',
            'max_retries' => 'nullable|integer|min:0|max:10',
            // Fast lane: capability narrows which client may claim an interactive
            // task (NULL = either); interactive=true promotes it onto remote_fast
            // at the FAST priority tier.
            'capability' => ['nullable', 'string', Rule::in(GlobalTask::CAPABILITIES)],
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

        $priority = 0;
        if (isset($validated['priority'])) {
            $priority = $validated['priority'];
        }

        $maxRetries = 3;
        if (isset($validated['max_retries'])) {
            $maxRetries = $validated['max_retries'];
        }

        $interactive = (bool) ($validated['interactive'] ?? false);
        $capability = $validated['capability'] ?? null;

        $task = $this->taskManager->createTask(
            $validated['app_name'],
            $validated['task_type'],
            $validated['execution_type'],
            $payload,
            $timeoutSeconds,
            $priority,
            $maxRetries,
            $interactive,
            $capability
        );

        return $this->success([
            'task_id' => $task->task_id,
            'execution_type' => $task->execution_type,
            'priority' => $task->priority,
            'is_fast_tier' => (bool) $task->is_fast_tier,
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

        $assignedAt = null;
        if ($task->assigned_at) {
            $assignedAt = $task->assigned_at->toISOString();
        }

        $completedAt = null;
        if ($task->completed_at) {
            $completedAt = $task->completed_at->toISOString();
        }

        $timeoutAt = null;
        if ($task->timeout_at) {
            $timeoutAt = $task->timeout_at->toISOString();
        }

        return $this->success([
            'task' => [
                'task_id' => $task->task_id,
                'app_name' => $task->app_name,
                'task_type' => $task->task_type,
                'execution_type' => $task->execution_type,
                'status' => $task->status,
                'progress' => $task->progress,
                'priority' => $task->priority,
                'retry_count' => $task->retry_count,
                'max_retries' => $task->max_retries,
                'timeout_seconds' => $task->timeout_seconds,
                'assigned_to' => $task->assigned_to,
                'payload' => $task->payload,
                'result' => $task->result,
                'error' => $task->error,
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
                'assigned_at' => $assignedAt,
                'timeout_at' => $timeoutAt,
                'completed_at' => $completedAt,
            ],
        ], 'Task status retrieved successfully');
    }

    /**
     * Bump a task to the front of the queue ("jump to task-top").
     *
     * POST /api/task/{taskId}/bump   body: { priority?: int (default PRIORITY_FAST) }
     *
     * 200 + new priority on success; 404 unknown task; 409 if the task is no
     * longer pending (assigned/processing/terminal cannot be reordered).
     * Control-plane endpoint (no auth, same as the rest of this group).
     */
    public function bump(string $taskId, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'priority' => 'nullable|integer|min:0|max:1000',
        ]);

        $priority = (int) ($validated['priority'] ?? GlobalTask::PRIORITY_FAST);

        $outcome = $this->taskManager->bumpTaskPriority($taskId, $priority);

        if ($outcome === 'not_found') {
            return $this->notFound('Task not found');
        }
        if ($outcome === 'not_pending') {
            return $this->error('Task is not pending and cannot be bumped', 409);
        }

        $task = GlobalTask::where('task_id', $taskId)->first();

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
        $task = GlobalTask::where('task_id', $taskId)->first();

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success(
            $this->taskDetailData($task),
            'Task detail retrieved successfully'
        );
    }

    /**
     * Build the canonical detail payload consumed by BOTH the /detail endpoint
     * and the /stream `task.detail-initial` SSE event, so the UI sees one shape.
     *
     * @return array<string,mixed>
     */
    protected function taskDetailData(GlobalTask $task): array
    {
        $iso = static function ($dt) {
            return $dt ? $dt->toISOString() : null;
        };

        // Bound the snapshot to the most-recent STREAM_BATCH_LIMIT events (the
        // stream tail is capped at the same limit) so a long-lived task with a
        // huge timeline cannot load an unbounded set on open. Fetch newest-first,
        // then reverse to chronological order for the UI.
        $events = GlobalTaskEvent::forTask($task->task_id)
            ->reorder('id', 'desc')
            ->limit(self::STREAM_BATCH_LIMIT)
            ->get()
            ->reverse()
            ->values()
            ->map(function ($e) use ($iso) {
                return [
                    'id' => $e->id,
                    'event' => $e->event,
                    'worker_id' => $e->worker_id,
                    'attempt' => $e->attempt,
                    'detail' => $e->detail,
                    'created_at' => $iso($e->created_at),
                ];
            })->all();

        // Derived current phase: for an in-flight task, how long it has been in
        // the hands of its assigned worker.
        $elapsed = null;
        if ($task->assigned_at && in_array($task->status, [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING], true)) {
            // Carbon 3 diffInSeconds returns a float — cast to int so the wire
            // shape stays an integer second count.
            $elapsed = (int) max(0, now()->diffInSeconds($task->assigned_at, false) * -1);
        }

        $timeoutIn = null;
        if ($task->timeout_at && in_array($task->status, [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING], true)) {
            $timeoutIn = (int) max(0, now()->diffInSeconds($task->timeout_at, false));
        }

        return [
            'task' => [
                'task_id' => $task->task_id,
                'app_name' => $task->app_name,
                'task_type' => $task->task_type,
                'execution_type' => $task->execution_type,
                'capability' => $task->capability,
                'is_fast_tier' => (bool) $task->is_fast_tier,
                'status' => $task->status,
                'priority' => (int) $task->priority,
                'progress' => $task->progress,
                'payload' => $task->payload,
                'result' => $task->result,
                'error' => $task->error,
                'assigned_to' => $task->assigned_to,
                'assigned_at' => $iso($task->assigned_at),
                'timeout_at' => $iso($task->timeout_at),
                'completed_at' => $iso($task->completed_at),
                'created_at' => $iso($task->created_at),
                'updated_at' => $iso($task->updated_at),
            ],
            'events' => $events,
            'current_phase' => [
                'phase' => $task->status,
                'worker_id' => $task->assigned_to,
                'elapsed_seconds' => $elapsed,
            ],
            'metadata' => [
                'total_attempts' => (int) $task->retry_count,
                'max_retries' => (int) $task->max_retries,
                'will_retry' => $task->canRetry(),
                'estimated_timeout_in_seconds' => $timeoutIn,
            ],
        ];
    }

    // Bounded SSE connection lifetime — see stream(). Kept under Octane's
    // per-request watchdog so the worker isn't killed mid-stream; the client
    // reconnects by cursor and resumes with zero gap.
    private const STREAM_MAX_LIFETIME_SECONDS = 50;
    private const STREAM_POLL_INTERVAL_MS = 800;
    private const STREAM_BATCH_LIMIT = 200;
    private const STREAM_HEARTBEAT_SECONDS = 15;

    /**
     * Live per-task detail stream (SSE) for the drilldown modal.
     *
     * GET /api/task/{taskId}/stream?cursor=<lastEventId>
     *
     * Clones the proven AppQyV1TranslationStreamController eventStream pattern:
     * tails the EXISTING global_task_events rows (written on every transition) —
     * no Reverb, no new broadcast layer (BROADCAST_CONNECTION=log here). Emits
     * `task.detail-initial` (the full /detail payload) on open, then `task.event`
     * per new transition, `ping` keep-alives, and `stream.close` with the final
     * cursor. The stream ends when the task reaches a terminal status or the
     * lifetime cap is hit; the client reconnects by cursor.
     */
    public function stream(string $taskId, Request $request)
    {
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
        ]);

        $task = GlobalTask::where('task_id', $taskId)->first();
        if (!$task) {
            return $this->notFound('Task not found');
        }

        // cursor absent / 0 -> resume after this task's latest existing event so
        // a fresh subscriber gets the snapshot + only NEW transitions.
        $cursor = (int) ($validated['cursor'] ?? 0);
        if ($cursor <= 0) {
            $cursor = (int) (GlobalTaskEvent::forTask($taskId)->max('id') ?? 0);
        }

        // Effective lifetime MUST stay under Octane's per-request watchdog.
        $maxExec = (int) config('octane.max_execution_time', 30);
        $maxLifetime = $maxExec > 0
            ? max(5, min(self::STREAM_MAX_LIFETIME_SECONDS, $maxExec - 5))
            : self::STREAM_MAX_LIFETIME_SECONDS;

        $initial = $this->taskDetailData($task);
        $terminal = [
            GlobalTask::STATUS_COMPLETED,
            GlobalTask::STATUS_COMPLETED_DEMO,
            GlobalTask::STATUS_FAILED,
            GlobalTask::STATUS_CANCELLED,
        ];

        // Status captured from the initial snapshot so the generator can
        // short-circuit when the stream OPENS on an already-terminal task.
        $initialStatus = $task->status;

        $response = response()->eventStream(function () use ($taskId, $cursor, $maxLifetime, $initial, $terminal, $initialStatus) {
            $current = $cursor;
            $start = microtime(true);
            $lastBeat = $start;

            // Full snapshot on open so the modal renders instantly without a
            // separate /detail round-trip.
            yield new StreamedEvent(event: 'task.detail-initial', data: json_encode($initial, JSON_UNESCAPED_UNICODE));

            // Already terminal at open: there will never be more transitions, so
            // do not idle the full lifetime — emit a terminal close immediately.
            // done=true tells the consumer NOT to reconnect (SSE close contract).
            if (in_array($initialStatus, $terminal, true)) {
                yield new StreamedEvent(event: 'stream.close', data: json_encode(['cursor' => $current, 'done' => true]));
                return;
            }

            while ((microtime(true) - $start) < $maxLifetime) {
                $events = GlobalTaskEvent::forTask($taskId)
                    ->where('id', '>', $current)
                    ->limit(self::STREAM_BATCH_LIMIT)
                    ->get();

                if ($events->isNotEmpty()) {
                    foreach ($events as $evt) {
                        yield new StreamedEvent(
                            event: 'task.event',
                            data: json_encode([
                                'id' => $evt->id,
                                '_id' => $evt->id,
                                'task_id' => $taskId,
                                'event' => $evt->event,
                                'worker_id' => $evt->worker_id,
                                'attempt' => $evt->attempt,
                                'detail' => $evt->detail,
                                'created_at' => $evt->created_at ? $evt->created_at->toISOString() : null,
                            ], JSON_UNESCAPED_UNICODE)
                        );
                        $current = $evt->id;
                    }
                    $lastBeat = microtime(true);

                    // Close on a real terminal STATUS (not merely a 'failed' event,
                    // which may be a retry that re-queues the task to pending).
                    $status = GlobalTask::where('task_id', $taskId)->value('status');
                    if (in_array($status, $terminal, true)) {
                        break;
                    }

                    if ($events->count() >= self::STREAM_BATCH_LIMIT) {
                        continue;
                    }
                } elseif ((microtime(true) - $lastBeat) >= self::STREAM_HEARTBEAT_SECONDS) {
                    yield new StreamedEvent(event: 'ping', data: json_encode(['cursor' => $current]));
                    $lastBeat = microtime(true);
                }

                usleep(self::STREAM_POLL_INTERVAL_MS * 1000);
            }

            // SSE close contract: 'done' distinguishes a TERMINAL close (consumer
            // must NOT reconnect) from a lifetime-cap close on a still-live task
            // (consumer MUST reconnect from cursor to keep tailing). Read the
            // task's current status and test it against the terminal set.
            $closingStatus = GlobalTask::where('task_id', $taskId)->value('status');
            $done = in_array($closingStatus, $terminal, true);
            yield new StreamedEvent(event: 'stream.close', data: json_encode(['cursor' => $current, 'done' => $done]));
        });

        $response->headers->set('X-Accel-Buffering', 'no');
        $response->headers->set('Cache-Control', 'no-cache, no-transform');
        $response->headers->set('Connection', 'keep-alive');

        return $response;
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
                    // Additive routing fields (B11): let clients badge/sort a task
                    // row by its fast-lane / capability placement without opening
                    // per-task detail.
                    'capability' => $task->capability,
                    'priority' => (int) $task->priority,
                    'is_fast_tier' => (bool) $task->is_fast_tier,
                ];
            }),
        ], 'Tasks list retrieved successfully');
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
            'status' => GlobalTask::STATUS_CANCELLED,
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
