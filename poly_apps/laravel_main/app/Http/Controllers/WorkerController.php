<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Services\WorkerManagerService;
use App\Support\ServerRuntime;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
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
            // Derive the allowed lane set from the model's canonical EXECUTION_TYPES
            // so new lanes (remote_subtitle / remote_poster / remote_sentence_audio,
            // etc.) are accepted automatically and this rule can never drift.
            'processor_types.*' => ['string', Rule::in(GlobalTask::EXECUTION_TYPES)],
            // Capability tags for the shared remote_fast lane (NULL = legacy
            // worker, only claims NULL-capability fast tasks). Derived from the
            // model's canonical CAPABILITIES vocabulary (drift-proof).
            'capabilities' => 'nullable|array',
            'capabilities.*' => ['string', Rule::in(GlobalTask::CAPABILITIES)],
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

        $capabilities = $validated['capabilities'] ?? null;

        $worker = $this->workerManager->register(
            $validated['worker_id'],
            $validated['worker_name'],
            $validated['processor_types'],
            $hostname,
            $platform,
            $metadata,
            $capabilities
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

        // Notify signal: number of priority>=100 PENDING tasks waiting for this
        // worker's processor types. A non-zero value tells the worker to pull
        // immediately / poll faster (a resolve or library-words query bumps
        // missing-media tasks to priority 100).
        $processorTypes = $this->taskManager->workerProcessorTypes($validated['worker_id']);
        $capabilities = $this->taskManager->workerCapabilities($validated['worker_id']);
        $pendingUrgent = $this->taskManager->countUrgentPending($processorTypes);
        $pendingFast = $this->taskManager->countFastPending($processorTypes, $capabilities);

        return $this->success([
            'pending_urgent' => $pendingUrgent,
            // Shared fast lane backlog this worker can claim — a non-zero value
            // tells the client to re-poll immediately (wait=0) and process now.
            'pending_fast' => $pendingFast,
        ], 'Heartbeat received');
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
            // Long-poll wait budget (seconds). 0 = legacy immediate return.
            // Clamped server-side to MAX_LONG_POLL_SECONDS in the manager.
            'wait' => 'nullable|integer|min:0|max:30',
        ]);

        $workerId = $validated['worker_id'];
        $limit = $validated['limit'] ?? 5;
        // validate()'s `integer` rule checks but does NOT cast query-string params,
        // so $validated['wait'] arrives as the string "0"; cast before the strict
        // `=== 0` comparison below or the immediate-return fast path is never taken.
        $wait = isset($validated['wait']) ? (int) $validated['wait'] : null;

        // Long-poll by default: hold the request (cheap COUNT polling, no held DB
        // lock) until a task appears or the wait budget elapses, so a worker idling
        // on an empty queue is woken promptly the instant a high-priority task is
        // created. wait=0 restores the legacy immediate-return behavior.
        //
        // EXCEPTION: on the single-worker php -S runtime there is no request
        // concurrency, so a parked long-poll would occupy the ONE worker for its
        // whole wait budget and starve every other request (overview poll, list
        // fan-out, even /api/health). Force the immediate-return path there; idle
        // workers instead pace themselves off the pending_urgent/pending_fast
        // hints returned below. Long-poll stays enabled on Octane/fpm.
        if ($wait === 0 || ServerRuntime::isSingleWorker()) {
            $tasks = $this->taskManager->pullAndAssignTasksForWorker($workerId, $limit);
        } else {
            $tasks = $this->taskManager->pullAndAssignTasksLongPoll($workerId, $limit, $wait);
        }

        // Notify signal in the pull response too: the urgent backlog STILL waiting
        // after this pull (other high-priority tasks beyond the returned batch).
        $processorTypes = $this->taskManager->workerProcessorTypes($workerId);
        $capabilities = $this->taskManager->workerCapabilities($workerId);
        $pendingUrgent = $this->taskManager->countUrgentPending($processorTypes);
        $pendingFast = $this->taskManager->countFastPending($processorTypes, $capabilities);

        return $this->success([
            'count' => count($tasks),
            'pending_urgent' => $pendingUrgent,
            'pending_fast' => $pendingFast,
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
                    // Fast-lane routing fields so the worker can sort by priority
                    // and recognise capability-typed interactive work.
                    'capability' => $task->capability,
                    'is_fast_tier' => (bool) $task->is_fast_tier,
                    'created_at' => $createdAt,
                ];
            }, $tasks),
        ], 'Tasks pulled and assigned successfully');
    }

    /**
     * Accept (acknowledge) a pulled task
     *
     * POST /api/worker/tasks/accept
     *
     * Pull already assigns atomically, so this is an idempotent acknowledgment
     * kept for the documented pull -> accept -> result contract (the browser
     * dictionary worker calls it for every task). Accepting a task you already
     * own succeeds; a still-pending task is claimed; someone else's task is 409.
     */
    public function acceptTask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_id' => 'required|string',
            'worker_id' => 'required|string',
        ]);

        $outcome = $this->taskManager->acceptTask(
            $validated['task_id'],
            $validated['worker_id']
        );

        if ($outcome === 'not_found') {
            return $this->notFound('Task or worker not found');
        }

        if ($outcome === 'conflict') {
            return $this->error('Task is owned by another worker or already finished', 409);
        }

        return $this->success([
            'task_id' => $validated['task_id'],
            'worker_id' => $validated['worker_id'],
        ], 'Task accepted');
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

        // Capture the write-back reception summary so the worker can log exactly
        // what the backend stored ({status, stored_count, failed_count,
        // synced_to_dict} plus the granular {saved, invalid, audio_saved,
        // images_saved} the word-translation write-back reports).
        $outcome = null;
        $success = $this->taskManager->submitResult(
            $validated['task_id'],
            $validated['worker_id'],
            $validated['status'],
            $progress,
            $result,
            $error,
            $outcome
        );

        if (!$success) {
            return $this->error('Worker not assigned to this task or task was reassigned', 409);
        }

        return $this->success($outcome, 'Result submitted');
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
