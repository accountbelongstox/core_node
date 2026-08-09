<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Models\GlobalTaskEvent;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use App\Support\ServerRuntime;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\StreamedEvent;
use Illuminate\Validation\Rule;
use App\Traits\ApiResponse;
use App\Utils\SseStreamResponse;

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
            // Task type, lane, capability, and priority are all read from the
            // shared JSON task model used by Pycore, both UIs, and mcp-chrome.
            'task_type' => ['required', 'string', Rule::in(array_column(QueueCenterContract::taskTypes(), 'key'))],
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
        $task = GlobalTask::where('task_id', $taskId)->first();

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success([
            'task' => QueueCenterContract::projectTask($task, 'status'),
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
        // Bound the snapshot to the central event_batch limit (the stream tail
        // uses the same value) so a long-lived task cannot load an unbounded
        // timeline. Fetch newest-first, then reverse for chronological UI order.
        $events = GlobalTaskEvent::forTask($task->task_id)
            ->reorder('id', 'desc')
            ->limit(QueueCenterContract::taskLimit('event_batch'))
            ->get()
            ->reverse()
            ->values()
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

    // Bounded SSE connection lifetime — see stream(). Kept under Octane's
    // per-request watchdog so the worker isn't killed mid-stream; the client
    // reconnects by cursor and resumes with zero gap.
    private const STREAM_MAX_LIFETIME_SECONDS = 50;
    private const STREAM_POLL_INTERVAL_MS = 800;
    private const STREAM_HEARTBEAT_SECONDS = 15;
    // On the single-worker php -S runtime the SSE generator occupies the ONE
    // worker for its whole lifetime, starving all other requests. Cap the
    // lifetime hard there so the worker is released every few seconds; the
    // client reconnects by cursor (done=false), turning the stream into a
    // near-short-poll that lets other requests interleave. No effect on Octane.
    private const STREAM_SINGLE_WORKER_LIFETIME_SECONDS = 3;

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

        // Single-worker php -S: hard-cap the hold so the sole worker is freed
        // frequently and other requests are not starved (client reconnects by
        // cursor). Overrides the Octane-oriented budget above on this runtime.
        if (ServerRuntime::isSingleWorker()) {
            $maxLifetime = self::STREAM_SINGLE_WORKER_LIFETIME_SECONDS;
        }

        $initial = $this->taskDetailData($task);
        $terminal = GlobalTask::statuses('terminal');

        // Status captured from the initial snapshot so the generator can
        // short-circuit when the stream OPENS on an already-terminal task.
        $initialStatus = $task->status;

        return SseStreamResponse::make(function () use ($taskId, $cursor, $maxLifetime, $initial, $terminal, $initialStatus) {
            $current = $cursor;
            $start = microtime(true);
            $lastBeat = $start;

            // Full snapshot on open so the modal renders instantly without a
            // separate /detail round-trip.
            yield new StreamedEvent(event: QueueCenterContract::taskStreamEvent('initial'), data: json_encode($initial, JSON_UNESCAPED_UNICODE));

            // Already terminal at open: there will never be more transitions, so
            // do not idle the full lifetime — emit a terminal close immediately.
            // done=true tells the consumer NOT to reconnect (SSE close contract).
            if (in_array($initialStatus, $terminal, true)) {
                yield new StreamedEvent(event: QueueCenterContract::taskStreamEvent('close'), data: json_encode(['cursor' => $current, 'done' => true]));
                return;
            }

            while ((microtime(true) - $start) < $maxLifetime) {
                $events = GlobalTaskEvent::forTask($taskId)
                    ->where('id', '>', $current)
                    ->limit(QueueCenterContract::taskLimit('event_batch'))
                    ->get();

                if ($events->isNotEmpty()) {
                    foreach ($events as $evt) {
                        $eventPayload = QueueCenterContract::projectTask($evt, 'event');
                        // SSE adds only the transport resume cursor; the event
                        // record itself is the central event wire shape.
                        $eventPayload['_id'] = $evt->id;
                        yield new StreamedEvent(
                            event: QueueCenterContract::taskStreamEvent('transition'),
                            data: json_encode($eventPayload, JSON_UNESCAPED_UNICODE)
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

                    if ($events->count() >= QueueCenterContract::taskLimit('event_batch')) {
                        continue;
                    }
                } elseif ((microtime(true) - $lastBeat) >= self::STREAM_HEARTBEAT_SECONDS) {
                    yield new StreamedEvent(event: QueueCenterContract::taskStreamEvent('ping'), data: json_encode(['cursor' => $current]));
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
            yield new StreamedEvent(event: QueueCenterContract::taskStreamEvent('close'), data: json_encode(['cursor' => $current, 'done' => $done]));
        });
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

        // Total: on the hot 5s poll, avoid a second full-table count(*) by reading
        // it from the short-TTL cached status tally for the common filters (none,
        // or status-only — the only filters the Task Center FE sends). Fall back
        // to an exact count only for the rarer app_name/execution_type filters.
        if ($request->has('app_name') || $request->has('execution_type')) {
            $total = $query->count();
        } else {
            $stats = $this->taskManager->getTaskStats();
            $total = $request->has('status')
                ? (int) ($stats[$request->status] ?? 0)
                : (int) ($stats['total'] ?? 0);
        }

        // Explicit projection: the response below uses only these scalar columns,
        // so never SELECT * — which would de-TOAST the heavy payload/steps/result
        // JSON columns for up to `limit` rows on every poll. ORDER BY created_at
        // DESC is backed by the (status, created_at) / (created_at) indexes.
        $tasks = $query->select([
                'task_id', 'app_name', 'task_type', 'execution_type', 'status',
                'progress', 'assigned_to', 'created_at', 'capability', 'priority',
                'is_fast_tier',
            ])
            ->orderBy('created_at', 'desc')
            ->skip($offset)
            ->take($limit)
            ->get();

        return $this->success([
            'total' => $total,
            'count' => $tasks->count(),
            // The summary projection is also the TaskRow/GlobalTaskItem model in
            // mcp-chrome and both manager UIs.
            'tasks' => $tasks->map(
                static fn ($task): array => QueueCenterContract::projectTask($task, 'summary')
            ),
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
        $deletedCount = GlobalTask::whereNull('payload')->delete();

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

        $updatedCount = GlobalTask::whereIn('status', $statuses)
            ->update([
                'status' => GlobalTask::status('pending'),
                'assigned_to' => null,
                'assigned_at' => null,
                'timeout_at' => null,
            ]);

        return $this->success([
            'reset_count' => $updatedCount,
            'include_processing' => $includeProcessing,
        ], 'Assigned tasks reset successfully');
    }
}
