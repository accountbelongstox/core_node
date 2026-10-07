<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PhraseExtractionService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PhraseLookupService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Services\ClientKey\ClientKeyAuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * POST /api/app_qy_v1/phrases/by_sentences (queue_center_contract endpoint
 * phrases_by_sentences; Sanctum user or client key).
 * Body: {language, content_ids[]} -> {items: [{content_id, status, phrases}]} in request order.
 *
 * GET /api/app_qy_v1/phrases/extraction_status (contract endpoint
 * phrases_extraction_status; same auth): extraction counters, timers and model health.
 */
class AppQyV1PhrasesBySentencesCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'PHRASES_BY_SENTENCES_VALIDATION_FAILED';
    private const CONTENT_IDS_MAX = 500;
    private const CONTENT_ID_LENGTH = 32;
    private const LANGUAGE_MAX = 20;

    public function __construct(private readonly AppQyV1PhraseLookupService $phrases)
    {
    }

    public function extractionStatus(Request $request): JsonResponse
    {
        if (AuthHelper::requireAuth($request) === null && !ClientKeyAuthService::hasSignature($request)) {
            return $this->unauthorized();
        }

        return $this->success(
            app(AppQyV1PhraseExtractionService::class)->status(),
            __('audio_orchestration.phrases_extraction_status_loaded')
        );
    }

    public function bySentences(Request $request): JsonResponse
    {
        if (AuthHelper::requireAuth($request) === null && !ClientKeyAuthService::hasSignature($request)) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->all(), [
            'language' => ['required', 'string', 'max:' . self::LANGUAGE_MAX],
            'content_ids' => ['required', 'array', 'min:1', 'max:' . self::CONTENT_IDS_MAX],
            'content_ids.*' => ['required', 'string', 'size:' . self::CONTENT_ID_LENGTH],
        ], [], [
            'language' => __('audio_orchestration.phrases_attribute_language'),
            'content_ids' => __('audio_orchestration.phrases_attribute_content_ids'),
        ]);
        if ($validator->fails()) {
            return $this->codedError(
                self::ERROR_VALIDATION_FAILED,
                __('audio_orchestration.phrases_by_sentences_validation_failed'),
                ['errors' => $validator->errors()->toArray()],
                422
            );
        }
        $validated = $validator->validated();

        return $this->success(
            ['items' => $this->phrases->bySentences((string) $validated['language'], array_values($validated['content_ids']))],
            __('audio_orchestration.phrases_by_sentences_loaded')
        );
    }
}
