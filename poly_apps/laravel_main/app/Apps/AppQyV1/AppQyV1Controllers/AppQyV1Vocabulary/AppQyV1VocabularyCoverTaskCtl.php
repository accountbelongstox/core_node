<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\Services\AppQyV1LibraryCoverTaskService;
use App\Http\Controllers\Controller;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Vocabulary-library cover tasks (AI generate / web image search) on the
 * global task queue: enqueue and status polling.
 */
class AppQyV1VocabularyCoverTaskCtl extends Controller
{
    use ApiResponse;

    private AppQyV1LibraryCoverTaskService $coverTaskService;

    public function __construct(AppQyV1LibraryCoverTaskService $coverTaskService)
    {
        $this->coverTaskService = $coverTaskService;
    }

    public function enqueue(Request $request): JsonResponse
    {
        $validator = null;
        $prompt = null;
        $result = [];

        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1|max:' . AppQyV1LibraryCoverTaskService::MAX_IDS,
            'ids.*' => 'required|integer|min:1',
            'mode' => ['required', 'string', Rule::in(QueueCenterContract::libraryCoverModes())],
            'prompt' => 'nullable|string|max:' . AppQyV1LibraryCoverTaskService::PROMPT_MAX_CHARS,
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors(), $validator->errors()->first());
        }

        $prompt = $request->filled('prompt') ? (string) $request->input('prompt') : null;
        $result = $this->coverTaskService->enqueue(
            (array) $request->input('ids'),
            (string) $request->input('mode'),
            $prompt
        );

        return $this->success($result, 'Library cover tasks queued');
    }

    public function status(Request $request): JsonResponse
    {
        $rawIds = null;
        $ids = [];
        $validator = null;

        $rawIds = $request->query('ids');
        $ids = is_array($rawIds)
            ? array_values($rawIds)
            : array_values(array_filter(array_map('trim', explode(',', (string) $rawIds)), static fn (string $id): bool => $id !== ''));

        $validator = Validator::make(['ids' => $ids], [
            'ids' => 'required|array|min:1|max:' . AppQyV1LibraryCoverTaskService::MAX_IDS,
            'ids.*' => 'required|integer|min:1',
        ], [
            'ids.required' => 'Query parameter ids is required (comma-separated library ids)',
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors(), $validator->errors()->first());
        }

        return $this->success($this->coverTaskService->statusForLibraries($ids), 'Library cover task status');
    }
}
