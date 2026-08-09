<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookReadingProgressService;

class AppQyV1BookReadingProgressController extends BaseController
{
    use ApiResponse;

    public function __construct(
        private readonly AppQyV1BookReadingProgressService $progressService,
    ) {
    }

    public function list(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $limit = min(500, max(1, (int) $request->query('limit', 100)));
        $items = $this->progressService->listForUser((int) $user->id, $limit);

        return $this->success(['items' => $items], 'Book reading progress retrieved');
    }

    public function get(Request $request, string $sourceKey): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $progress = $this->progressService->getForBook((int) $user->id, $sourceKey);

        return $this->success(['progress' => $progress], 'Book reading progress retrieved');
    }

    public function save(Request $request, string $sourceKey): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'chapter_index' => 'nullable|integer|min:0',
            'verse_seq' => 'required|integer|min:0',
            'grain' => 'nullable|string|max:32',
            'page' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $validated = $validator->validated();
        $progress = $this->progressService->saveForBook((int) $user->id, $sourceKey, $validated);

        return $this->success(['progress' => $progress], 'Book reading progress saved');
    }

    public function getDailyReading(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $progress = $this->progressService->getDailyReadingForUser((int) $user->id);

        return $this->success(['progress' => $progress], 'Daily reading progress retrieved');
    }

    public function saveDailyReading(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'article_id' => 'nullable|required_without:selection_mode|string|max:255',
            'selection_mode' => 'nullable|required_without:article_id|string|in:latest,resume,random',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $progress = $this->progressService->saveDailyReadingForUser(
            (int) $user->id,
            $validator->validated(),
        );

        return $this->success(['progress' => $progress], 'Daily reading progress saved');
    }
}
