<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Server-owned audio plan of one book (Sanctum; audio_orchestration_contract
 * book_plan): post the plan once, then follow status and ready ids by cursor.
 */
class AppQyV1BookAudioPlanCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'BOOK_AUDIO_PLAN_VALIDATION_FAILED';
    private const ERROR_BOOK_NOT_FOUND = 'BOOK_AUDIO_PLAN_BOOK_NOT_FOUND';
    private const ERROR_PLAN_NOT_FOUND = 'BOOK_AUDIO_PLAN_NOT_FOUND';
    private const LANGUAGES_MAX = 8;

    public function __construct(private readonly AppQyV1BookAudioPlanService $plans)
    {
    }

    public function plan(Request $request): JsonResponse
    {
        if (AuthHelper::requireAuth($request) === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->all(), [
            'source_key' => ['required', 'string', 'max:64'],
            'chapter_index' => ['nullable', 'integer', 'min:0'],
            'languages' => ['required', 'array', 'min:1', 'max:' . self::LANGUAGES_MAX],
            'languages.*' => ['string', 'max:20'],
            'include_words' => ['nullable', 'boolean'],
            'position' => ['nullable', 'integer', 'min:0'],
            'plan_hash' => ['nullable', 'string', 'max:64'],
        ]);
        if ($validator->fails()) {
            return $this->failed(self::ERROR_VALIDATION_FAILED, __('audio_orchestration.book_plan_validation_failed'), ['errors' => $validator->errors()->toArray()], 422);
        }
        $status = $this->plans->ensure($validator->validated());

        return $status === null
            ? $this->failed(self::ERROR_BOOK_NOT_FOUND, __('audio_orchestration.book_plan_book_not_found'), null, 404)
            : $this->success($status, __('audio_orchestration.book_plan_saved'));
    }

    public function status(Request $request, string $planId): JsonResponse
    {
        if (AuthHelper::requireAuth($request) === null) {
            return $this->unauthorized();
        }
        $status = $this->plans->status($planId);

        return $status === null
            ? $this->failed(self::ERROR_PLAN_NOT_FOUND, __('audio_orchestration.book_plan_not_found'), null, 404)
            : $this->success($status, __('audio_orchestration.book_plan_loaded'));
    }

    public function ready(Request $request, string $planId): JsonResponse
    {
        if (AuthHelper::requireAuth($request) === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->query(), [
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->failed(self::ERROR_VALIDATION_FAILED, __('audio_orchestration.book_plan_validation_failed'), ['errors' => $validator->errors()->toArray()], 422);
        }
        $page = $this->plans->ready(
            $planId,
            (int) $request->query('cursor', 0),
            (int) $request->query('limit', AppQyV1BookAudioPlanService::setting('ready_page_default'))
        );

        return $page === null
            ? $this->failed(self::ERROR_PLAN_NOT_FOUND, __('audio_orchestration.book_plan_not_found'), null, 404)
            : $this->success($page, __('audio_orchestration.book_plan_loaded'));
    }

    private function failed(string $errorCode, string $message, ?array $details, int $httpCode): JsonResponse
    {
        return $this->codedError($errorCode, $message, $details, $httpCode);
    }
}
