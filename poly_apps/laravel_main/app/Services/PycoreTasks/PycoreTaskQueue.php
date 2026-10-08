<?php

namespace App\Services\PycoreTasks;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Local-compute work Laravel hands to pycore (LARAVEL_GUIDE §1 pycore
 * boundary): Laravel never calls pycore; it records an available global task,
 * a pycore whose compute class fits pulls it, and posts the result back.
 * Keyed AI never comes here; it runs in Laravel's AI gateway.
 *
 * request() is idempotent per (task_type, group_key); the group key is the
 * caller's client_task_id when given, else the task input. It returns one of:
 * - completed:   {status, task_id, result}
 * - pending:     {success: false, queued: true, pycore_task: {...}}
 * - unavailable: {success: false, queued, error_code: pycore_unavailable, error, pycore_unavailable: {...}}
 *   when no suitable pycore is online; the task type's offline_policy decides
 *   whether the task is still queued (202) or rejected (503).
 */
final class PycoreTaskQueue
{
    public const STATE_COMPLETED = 'completed';
    public const ERROR_UNAVAILABLE = 'pycore_unavailable';
    public const ERROR_CLIENT_TASK_ID_CONFLICT = 'client_task_id_conflict';
    /** Payload field carrying the input hash of a client_task_id task. */
    private const INPUT_HASH_FIELD = 'input_sha1';
    private const HTTP_CONFLICT = 409;
    public const CLIENT_TASK_ID_RULE = 'nullable|string|max:128|regex:'.self::CLIENT_TASK_ID_PATTERN;
    private const CLIENT_TASK_ID_PATTERN = '/^[A-Za-z0-9._:-]{1,128}$/';
    private const IDEMPOTENCY_HEADER = 'Idempotency-Key';

    private const APP_NAME = 'AppQyV1';
    private const PYCORE_CLAIMANT = 'pycore';
    private const DEFAULT_TIMEOUT_SECONDS = 300;
    private const POLL_ROUTE = '/api/task/%s/status';
    private const HTTP_ACCEPTED = 202;
    private const HTTP_UNAVAILABLE = 503;
    private const DISPOSITION_QUEUED = 'queued';
    private const DISPOSITION_REJECTED = 'rejected';

    /**
     * $requeueCompleted: the caller keeps the result outside the task row (a
     * stored file) and found it missing, so a completed task is queued again.
     */
    public static function request(
        string $taskType,
        array $payload,
        array $identity,
        ?string $clientTaskId = null,
        int $priority = 0,
        bool $requeueCompleted = false
    ): array {
        $clientTaskId = $clientTaskId !== null && $clientTaskId !== '' ? $clientTaskId : null;
        $groupKey = self::groupKey($taskType, $clientTaskId !== null ? ['client_task_id' => $clientTaskId] : $identity);
        $inputHash = self::groupKey($taskType, $identity);
        $newest = GlobalTask::newestByGroupKeys([$taskType], [$groupKey])[$groupKey] ?? null;
        $availability = null;
        $task = null;

        // A reused client_task_id must name the same input; another input is a 409.
        if ($clientTaskId !== null && $newest !== null
            && (string) (($newest->payload ?? [])[self::INPUT_HASH_FIELD] ?? $inputHash) !== $inputHash) {
            return [
                'success' => false,
                'error_code' => self::ERROR_CLIENT_TASK_ID_CONFLICT,
                'error' => __('pycore.client_task_id_conflict', ['client_task_id' => $clientTaskId, 'task_id' => $newest->task_id]),
                'task_id' => (string) $newest->task_id,
            ];
        }

        if (!$requeueCompleted && $newest !== null && $newest->status === GlobalTask::status('completed')) {
            return [
                'status' => self::STATE_COMPLETED,
                'task_id' => (string) $newest->task_id,
                'result' => is_array($newest->result) ? $newest->result : [],
            ];
        }
        $availability = PycoreComputeRoster::availability($taskType);
        $task = $newest !== null && in_array($newest->status, QueueCenterContract::taskStatuses('live'), true) ? $newest : null;
        if ($task === null && ($availability['online_pycores'] > 0
            || QueueCenterContract::taskTypeOfflinePolicy($taskType) === QueueCenterContract::OFFLINE_QUEUE)) {
            $task = app(TaskManagerService::class)->createTaskOnce(
                self::APP_NAME,
                $taskType,
                $payload + array_filter(['client_task_id' => $clientTaskId, self::INPUT_HASH_FIELD => $clientTaskId !== null ? $inputHash : null]),
                $groupKey,
                self::DEFAULT_TIMEOUT_SECONDS,
                $priority
            )['task'];
        }

        return $availability['online_pycores'] > 0 && $task !== null
            ? self::pending($taskType, $task, $clientTaskId, $newest)
            : self::unavailable($taskType, $task, $clientTaskId, $availability);
    }

    /**
     * For background jobs that need the result before their next step: one
     * non-blocking look at the pending task of $view; the job resumes on a
     * later tick while the task is still live, so no worker ever sleeps on
     * pycore. $watch is the {fingerprint, changed_at} of the previous look
     * (null on the first); a pending answer carries the updated watch.
     *
     * @return array the completed state, a {success: false, error} failure, the unavailable view (still pending with no suitable pycore online), the pending view with watch, or the pending view with stalled: true when the task showed no change (status / progress / updated_at) for the worker heartbeat TTL
     */
    public static function poll(array $view, ?array $watch = null): array
    {
        $taskId = (string) ($view['pycore_task']['task_id'] ?? '');
        $taskType = (string) ($view['pycore_task']['task_type'] ?? '');
        $stallSeconds = QueueCenterContract::taskLimit('worker_heartbeat_ttl_seconds');
        $view = array_diff_key($view, ['watch' => true]);
        $task = null;
        $current = '';
        $changedAt = 0;

        if ($taskId === '') {
            return $view;
        }
        $task = GlobalTask::findByTaskId($taskId);
        if ($task === null) {
            return ['success' => false, 'error' => __('pycore.task_result_invalid', ['task_id' => $taskId])];
        }
        if ($task->status === GlobalTask::status('completed')) {
            return ['status' => self::STATE_COMPLETED, 'task_id' => $taskId, 'result' => is_array($task->result) ? $task->result : []];
        }
        if (!in_array($task->status, QueueCenterContract::taskStatuses('live'), true)) {
            return ['success' => false, 'task_id' => $taskId, 'error' => (string) ($task->error ?: $task->status)];
        }
        if ($task->status === GlobalTask::status('pending')
            && PycoreComputeRoster::availability($taskType)['online_pycores'] === 0) {
            return self::availabilityView($taskType, $taskId) ?? $view;
        }
        $current = $task->status.'|'.$task->progress.'|'.$task->updated_at;
        $changedAt = $current === (string) ($watch['fingerprint'] ?? '') ? (int) ($watch['changed_at'] ?? time()) : time();
        if (time() - $changedAt > $stallSeconds) {
            return $view + ['stalled' => true, 'error' => __('pycore.task_stalled', ['task_id' => $taskId, 'seconds' => $stallSeconds])];
        }

        return $view + ['watch' => ['fingerprint' => $current, 'changed_at' => $changedAt]];
    }

    /** Whether $view is a pending task still worth waiting on (not stalled, not unavailable). */
    public static function stillPending(array $view): bool
    {
        return is_array($view['pycore_task'] ?? null) && empty($view['stalled']) && !isset($view['pycore_unavailable']);
    }

    /**
     * The caller's job key: body `client_task_id`, else the `Idempotency-Key`
     * header (the UI sends both, and uses the same key for its direct-pycore
     * failover). A header value that does not match the pattern is ignored.
     */
    public static function clientTaskId(Request $request): ?string
    {
        $value = (string) ($request->input('client_task_id') ?? $request->header(self::IDEMPOTENCY_HEADER, ''));

        return preg_match(self::CLIENT_TASK_ID_PATTERN, $value) === 1 ? $value : null;
    }

    /** Deterministic group key of one task input. */
    public static function groupKey(string $taskType, array $identity): string
    {
        return sha1($taskType.'|'.json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /**
     * HTTP answer for a pending or unavailable view (null for a completed one,
     * which the caller renders as its domain result). Pending is a 202 success
     * envelope with data.pycore_task; unavailable is the error envelope with
     * error_code pycore_unavailable, 202 when queued, 503 when rejected, plus Retry-After.
     */
    public static function response(array $view, array $data = []): ?JsonResponse
    {
        $unavailable = $view['pycore_unavailable'] ?? null;

        if (($view['error_code'] ?? null) === self::ERROR_CLIENT_TASK_ID_CONFLICT) {
            return response()->json([
                'success' => false,
                'error_code' => self::ERROR_CLIENT_TASK_ID_CONFLICT,
                'error' => $view['error'],
                'message' => $view['error'],
                'data' => $data + ['task_id' => $view['task_id']],
                'code' => self::HTTP_CONFLICT,
                'status' => 'error',
            ], self::HTTP_CONFLICT);
        }

        if (is_array($unavailable)) {
            $status = $unavailable['disposition'] === self::DISPOSITION_QUEUED ? self::HTTP_ACCEPTED : self::HTTP_UNAVAILABLE;

            return response()->json([
                'success' => false,
                'error_code' => self::ERROR_UNAVAILABLE,
                'error' => $view['error'],
                'message' => $view['error'],
                'data' => $data + $unavailable,
                'code' => $status,
                'status' => 'error',
            ], $status, ['Retry-After' => (string) $unavailable['retry_after_seconds']]);
        }
        if (is_array($view['pycore_task'] ?? null)) {
            return response()->json([
                'success' => true,
                'message' => __('pycore.task_queued', ['task_id' => $view['pycore_task']['task_id']]),
                'data' => $data + ['pycore_task' => $view['pycore_task']],
            ], self::HTTP_ACCEPTED);
        }

        return null;
    }

    /**
     * Unavailable view for a task another producer already created or chose
     * not to create (the existing queue lanes: word/sentence/article audio,
     * STT, transcription, subtitle search), or null while a suitable pycore is
     * online or when pycore does not claim this task type. Without a task id
     * the disposition follows the type's offline_policy (lane-level view).
     */
    public static function availabilityView(string $taskType, ?string $taskId, ?string $clientTaskId = null): ?array
    {
        $availability = null;

        if (!in_array(self::PYCORE_CLAIMANT, QueueCenterContract::taskTypeClaimants($taskType), true)) {
            return null;
        }
        $availability = PycoreComputeRoster::availability($taskType);
        if ($availability['online_pycores'] > 0) {
            return null;
        }
        $queued = $taskId !== null
            || QueueCenterContract::taskTypeOfflinePolicy($taskType) === QueueCenterContract::OFFLINE_QUEUE;
        $view = self::unavailable($taskType, null, $clientTaskId, $availability);
        $view['queued'] = $queued;
        $view['pycore_unavailable']['task_id'] = $taskId;
        $view['pycore_unavailable']['disposition'] = $queued ? self::DISPOSITION_QUEUED : self::DISPOSITION_REJECTED;

        return $view;
    }

    /** Whether a producer should create a task of this type now (offline_policy). */
    public static function mayEnqueue(string $taskType): bool
    {
        return QueueCenterContract::taskTypeOfflinePolicy($taskType) === QueueCenterContract::OFFLINE_QUEUE
            || !in_array(self::PYCORE_CLAIMANT, QueueCenterContract::taskTypeClaimants($taskType), true)
            || PycoreComputeRoster::availability($taskType)['online_pycores'] > 0;
    }

    /** The queue part of a view, embedded next to a domain field (audio entries). */
    public static function embed(array $view): array
    {
        return array_intersect_key($view, array_flip(['pycore_task', 'error_code', 'error', 'pycore_unavailable']));
    }

    private static function pending(string $taskType, GlobalTask $task, ?string $clientTaskId, ?GlobalTask $previous): array
    {
        $lastError = $previous !== null && $previous->task_id !== $task->task_id ? (string) ($previous->error ?? '') : '';

        $view = [
            'status' => (string) $task->status,
            'task_id' => (string) $task->task_id,
            'task_type' => $taskType,
            'client_task_id' => $clientTaskId,
            'required_compute' => QueueCenterContract::taskTypeComputeStrictest($taskType),
            'poll' => sprintf(self::POLL_ROUTE, $task->task_id),
        ];

        if ($lastError !== '') {
            $view['last_error'] = $lastError;
        }

        return ['success' => false, 'queued' => true, 'pycore_task' => $view];
    }

    private static function unavailable(string $taskType, ?GlobalTask $task, ?string $clientTaskId, array $availability): array
    {
        $required = QueueCenterContract::taskTypeComputeStrictest($taskType);

        return [
            'success' => false,
            'queued' => $task !== null,
            'error_code' => self::ERROR_UNAVAILABLE,
            'error' => __('pycore.unavailable', ['compute' => $required, 'task_type' => $taskType]),
            'pycore_unavailable' => [
                'task_type' => $taskType,
                'required_compute' => $required,
                'registered_pycores' => $availability['registered_pycores'],
                'eligible_pycores' => $availability['eligible_pycores'],
                'last_seen_at' => $availability['last_seen_at'],
                'heartbeat_ttl_seconds' => QueueCenterContract::taskLimit('worker_heartbeat_ttl_seconds'),
                'disposition' => $task !== null ? self::DISPOSITION_QUEUED : self::DISPOSITION_REJECTED,
                'task_id' => $task?->task_id,
                'client_task_id' => $clientTaskId,
                'retry_after_seconds' => QueueCenterContract::taskLimit('pycore_unavailable_retry_seconds'),
            ],
        ];
    }

    private function __construct()
    {
    }
}
