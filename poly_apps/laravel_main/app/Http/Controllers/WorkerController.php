<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Services\WorkerManagerService;
use App\Services\QueueCenter\QueueSliceDiffService;
use App\Support\QueueCenterContract;
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
            // The model delegates to config/queue_center_contract.json. Pycore,
            // both manager UIs, and mcp-chrome read that same task vocabulary.
            'processor_types.*' => ['string', Rule::in(GlobalTask::executionTypes())],
            // Capability tags for the shared remote_fast lane (NULL = legacy
            // worker, only claims NULL-capability fast tasks). Derived from the
            // same central capability vocabulary.
            'capabilities' => 'nullable|array',
            'capabilities.*' => ['string', Rule::in(GlobalTask::capabilities())],
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
            'capabilities' => 'nullable|array',
            'capabilities.*' => ['string', Rule::in(GlobalTask::capabilities())],
        ]);

        $capabilities = $validated['capabilities'] ?? null;
        $success = $this->workerManager->heartbeat($validated['worker_id'], $capabilities);

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
            // tells the client to re-poll immediately and process now.
            'pending_fast' => $pendingFast,
        ], 'Heartbeat received');
    }

    /**
     * Mark a worker offline immediately.
     *
     * POST /api/worker/unregister
     */
    public function unregister(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string',
        ]);
        $workerId = $validated['worker_id'];

        if (!$this->workerManager->unregister($workerId)) {
            return $this->notFound('Worker not found');
        }

        return $this->success([
            'worker_id' => $workerId,
            'status' => 'offline',
        ], 'Worker unregistered successfully');
    }

    /**
     * Known task_type keys from the central contract (task_types[].key).
     *
     * @return array<int,string>
     */
    private function taskTypeKeys(): array
    {
        return QueueCenterContract::taskTypeKeys();
    }

    /**
     * 404 when the path task type is not a contract task type.
     */
    private function invalidTaskType(string $taskType): ?JsonResponse
    {
        if (in_array($taskType, $this->taskTypeKeys(), true)) {
            return null;
        }

        return $this->notFound("Unknown task type: {$taskType}");
    }

    /**
     * The stored task_type of one task (null when the task does not exist).
     */
    private function storedTaskType(string $taskId): ?string
    {
        return GlobalTask::taskTypeOf($taskId);
    }

    /**
     * Pull tasks of one task type for worker.
     * Tasks are automatically assigned to worker atomically
     *
     * GET /api/worker/tasks/{taskType}/pull
     */
    public function pullTasks(Request $request, string $taskType): JsonResponse
    {
        if ($invalid = $this->invalidTaskType($taskType)) {
            return $invalid;
        }
        $pullLimit = QueueCenterContract::taskLimit('worker_pull');
        $validated = $request->validate([
            'worker_id' => 'required|string',
            'worker_name' => 'nullable|string',
            'processor_types' => 'nullable|array',
            'processor_types.*' => ['string', Rule::in(GlobalTask::executionTypes())],
            'capabilities' => 'nullable|array',
            'capabilities.*' => ['string', Rule::in(GlobalTask::capabilities())],
            'capabilities_present' => 'nullable|boolean',
            'hostname' => 'nullable|string',
            'platform' => 'nullable|string',
            'metadata' => 'nullable|array',
            'limit' => "nullable|integer|min:1|max:{$pullLimit}",
        ]);

        $workerId = $validated['worker_id'];
        $sliceLimit = QueueCenterContract::consumerSliceLimit($taskType);
        $limit = min(
            (int) ($validated['limit'] ?? QueueCenterContract::taskLimit('worker_pull_default')),
            $sliceLimit
        );

        // Queue consumers advertise their identity on the pull itself. This keeps
        // worker discovery, capability refresh, and queue claiming in one request
        // instead of requiring a separate register + heartbeat handshake first.
        // Legacy consumers that already registered remain compatible because all
        // identity fields except worker_id are optional here.
        if (isset($validated['worker_name'], $validated['processor_types'])) {
            $this->workerManager->register(
                $workerId,
                $validated['worker_name'],
                $validated['processor_types'],
                $validated['hostname'] ?? null,
                $validated['platform'] ?? null,
                $validated['metadata'] ?? [],
                isset($validated['capabilities_present'])
                    ? ($validated['capabilities'] ?? [])
                    : null,
                true
            );
        } else {
            $this->workerManager->heartbeat(
                $workerId,
                $validated['capabilities'] ?? null
            );
        }

        $tasks = $this->taskManager->pullAndAssignTasksForWorker($workerId, $limit, $taskType);

        // Notify signal in the pull response too: the urgent backlog STILL waiting
        // after this pull (other high-priority tasks of this type beyond the
        // returned batch).
        $capabilities = isset($validated['capabilities_present'])
            ? ($validated['capabilities'] ?? [])
            : $this->taskManager->workerCapabilities($workerId);
        $pendingSignals = $this->taskManager->pendingSignalsForType($taskType, $capabilities);
        $queueDiff = app(QueueSliceDiffService::class)->snapshot($taskType, 0, false);

        return $this->success([
            'count' => count($tasks),
            'pending_urgent' => $pendingSignals['pending_urgent'],
            'pending_fast' => $pendingSignals['pending_fast'],
            'queue_cursor' => $queueDiff['cursor'],
            'progress' => $queueDiff['progress'],
            // The worker_pull field list is shared with the Pycore and
            // mcp-chrome worker models through the central JSON contract.
            'tasks' => array_map(
                static fn ($task): array => QueueCenterContract::projectTask($task, 'worker_pull'),
                $tasks
            ),
        ], 'Tasks pulled and assigned successfully');
    }

    /**
     * Accept (acknowledge) a pulled task of the given type
     *
     * POST /api/worker/tasks/{taskType}/accept
     *
     * Pull already assigns atomically, so this is an idempotent acknowledgment
     * kept for the documented pull -> accept -> result contract (the browser
     * dictionary worker calls it for every task). Accepting a task you already
     * own succeeds; a still-pending task is claimed; someone else's task is 409.
     */
    public function acceptTask(Request $request, string $taskType): JsonResponse
    {
        if ($invalid = $this->invalidTaskType($taskType)) {
            return $invalid;
        }

        $validated = $request->validate([
            'task_id' => 'required|string',
            'worker_id' => 'required|string',
        ]);

        $storedType = $this->storedTaskType($validated['task_id']);
        if ($storedType === null) {
            return $this->notFound('Task or worker not found');
        }
        if ($storedType !== $taskType) {
            return $this->error("Task type mismatch: task is '{$storedType}', not '{$taskType}'", 422);
        }

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
     * Submit the result of a task of the given type
     *
     * POST /api/worker/tasks/{taskType}/result
     */
    public function submitResult(Request $request, string $taskType): JsonResponse
    {
        if ($invalid = $this->invalidTaskType($taskType)) {
            return $invalid;
        }

        $validated = $request->validate([
            'task_id' => 'required|string',
            'worker_id' => 'required|string',
            'attempt' => 'nullable|integer|min:0',
            'status' => ['required', 'string', Rule::in(GlobalTask::statuses('worker_reportable'))],
            'progress' => 'nullable|numeric|min:0|max:100',
            'result' => 'nullable|array',
            'error' => 'nullable|string',
        ]);

        $storedType = $this->storedTaskType($validated['task_id']);
        if ($storedType === null) {
            return $this->notFound('Task not found');
        }
        if ($storedType !== $taskType) {
            return $this->error("Task type mismatch: task is '{$storedType}', not '{$taskType}'", 422);
        }

        // NULL when the worker omitted progress (a lease keep-alive ping —
        // d.txt 7): the service then leaves the stored progress untouched and
        // only extends the task lease.
        $progress = $validated['progress'] ?? null;

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
            $validated['attempt'] ?? null,
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
        $workers = $this->workerManager->getWorkerSummaries();

        return $this->success([
            'count' => $workers->count(),
            'workers' => $workers,
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
