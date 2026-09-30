<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1VirtualReadBatchService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * A user's named virtual read batches: list (with use and references), record
 * the reads of played words, delete. Creating a batch prunes the user's batches
 * to AppQyV1VirtualReadBatchService::MAX_BATCHES.
 */
class AppQyV1VirtualReadBatchCtl extends Controller
{
    use ApiResponse;

    public const BATCH_NAME_PATTERN = '[A-Za-z0-9._:-]{1,64}';
    private const ERROR_VALIDATION_FAILED = 'VIRTUAL_READ_BATCH_VALIDATION_FAILED';
    private const MAX_WORD_IDS = 500;

    public function __construct(private readonly AppQyV1VirtualReadBatchService $service)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if ($user === null) {
            return $this->unauthorized();
        }

        return $this->success($this->service->list((int) $user->id), __('audio_orchestration.virtual_batches_loaded'));
    }

    public function recordReads(Request $request, string $batchName): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if ($user === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->all(), [
            'language' => ['required', 'string', 'max:16'],
            'word_ids' => ['required', 'array', 'max:' . self::MAX_WORD_IDS],
            'word_ids.*' => ['integer', 'min:1'],
            'request_key' => ['nullable', 'string', 'max:128'],
        ]);
        if ($validator->fails()) {
            return $this->codedError(
                self::ERROR_VALIDATION_FAILED,
                __('audio_orchestration.virtual_batch_validation_failed', ['message' => $validator->errors()->first()]),
                ['errors' => $validator->errors()->toArray()],
                422
            );
        }

        return $this->success($this->service->recordReads(
            (int) $user->id,
            $batchName,
            (string) $request->input('language'),
            array_map('intval', (array) $request->input('word_ids')),
            $request->filled('request_key') ? (string) $request->input('request_key') : null
        ), __('audio_orchestration.virtual_batch_reads_recorded'));
    }

    public function destroy(Request $request, string $batchName): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if ($user === null) {
            return $this->unauthorized();
        }
        $result = $this->service->delete((int) $user->id, $batchName);
        if (isset($result['error_code'])) {
            return $this->codedError($result['error_code'], __('audio_orchestration.virtual_batch_not_found'), null, 404);
        }

        return $this->success($result, __('audio_orchestration.virtual_batch_deleted'));
    }
}
