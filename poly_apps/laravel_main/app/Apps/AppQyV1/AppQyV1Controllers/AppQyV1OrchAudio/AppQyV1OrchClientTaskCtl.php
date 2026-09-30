<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1OrchClientTaskService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Per-user manifest of client orchestration tasks (Sanctum).
 */
class AppQyV1OrchClientTaskCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'ORCH_CLIENT_TASK_VALIDATION_FAILED';
    private const LIST_PER_PAGE_DEFAULT = 50;
    private const LIST_PER_PAGE_MAX = 200;

    private AppQyV1OrchClientTaskService $service;

    public function __construct(AppQyV1OrchClientTaskService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        $validator = null;

        if ($user === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->query(), [
            'since' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:' . self::LIST_PER_PAGE_MAX],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        return $this->success($this->service->list(
            (int) $user->id,
            $request->filled('since') ? (string) $request->query('since') : null,
            (int) $request->query('page', 1),
            (int) $request->query('per_page', self::LIST_PER_PAGE_DEFAULT)
        ), __('audio_orchestration.orch_client_tasks_loaded'));
    }

    public function upsert(Request $request, string $clientTaskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        $validator = null;
        $result = null;

        if ($user === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->all(), [
            'name' => ['nullable', 'string', 'max:255'],
            'source' => ['required', 'string', 'max:32'],
            'language' => ['nullable', 'string', 'max:20'],
            'source_ref' => ['nullable', 'array'],
            'config' => ['nullable', 'array'],
            'plan_hash' => ['nullable', 'string', 'max:128'],
            'status' => ['nullable', 'string', 'max:32'],
            'segment_count' => ['nullable', 'integer', 'min:0'],
            'item_count' => ['nullable', 'integer', 'min:0'],
            'duration_ms' => ['nullable', 'integer', 'min:0'],
            'device_id' => ['nullable', 'string', 'max:64'],
            'client_updated_at' => ['required', 'date'],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        $result = $this->service->upsert((int) $user->id, $clientTaskId, $request->all());
        if (isset($result['error_code'])) {
            return $this->serviceError($result['error_code'], (int) $result['http']);
        }

        return $this->success($result['data'], __('audio_orchestration.orch_client_task_saved'));
    }

    public function destroy(Request $request, string $clientTaskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        $validator = null;

        if ($user === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->query(), [
            'client_updated_at' => ['required', 'date'],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        return $this->success($this->service->tombstone(
            (int) $user->id,
            $clientTaskId,
            (string) $request->query('client_updated_at')
        ), __('audio_orchestration.orch_client_task_deleted'));
    }

    private function validationFailed(array $errors): JsonResponse
    {
        return $this->codedError(
            self::ERROR_VALIDATION_FAILED,
            __('audio_orchestration.orch_client_task_validation_failed'),
            ['errors' => $errors],
            422
        );
    }

    private function serviceError(string $errorCode, int $httpCode): JsonResponse
    {
        return $this->codedError(
            $errorCode,
            __('audio_orchestration.' . strtolower($errorCode)),
            null,
            $httpCode
        );
    }
}
