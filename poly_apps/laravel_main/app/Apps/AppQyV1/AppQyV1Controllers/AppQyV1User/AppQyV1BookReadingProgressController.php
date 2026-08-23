<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookReadingProgressService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailyReadingResourceService;

class AppQyV1BookReadingProgressController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly AppQyV1BookReadingProgressService $progressService,
        private readonly AppQyV1DailyReadingResourceService $resourceService,
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

    public function previewDailyReadingResources(Request $request, string $articleId): JsonResponse
    {
        $user = null;
        $validator = null;
        $validated = [];
        $preview = null;

        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error(__('article.daily_reading_unauthorized'), 401);
        }

        $validator = Validator::make($request->all(), [
            'group_id' => 'nullable|string|max:64',
            'settings' => 'nullable|array:playbackMode,wordMode,wordOrder,newOnlyMaxReadCount,underlineCurrentSentence,bilingual,sentenceRate,wordRate,playbackPattern',
            'settings.playbackMode' => 'nullable|string|in:sequential,repeat-all,repeat-one,shuffle',
            'settings.wordMode' => 'nullable|string|in:off,new,all',
            'settings.wordOrder' => 'nullable|string|in:sentence,shuffle,alpha',
            'settings.newOnlyMaxReadCount' => 'nullable|integer|min:0|max:100',
            'settings.underlineCurrentSentence' => 'nullable|boolean',
            'settings.bilingual' => 'nullable|boolean',
            'settings.sentenceRate' => 'nullable|numeric|min:0.25|max:4',
            'settings.wordRate' => 'nullable|numeric|min:0.25|max:4',
            'settings.playbackPattern' => 'nullable|array|max:12',
            'settings.playbackPattern.*' => 'array:id,type,lang,times',
            'settings.playbackPattern.*.id' => 'required|string|max:96',
            'settings.playbackPattern.*.type' => 'required|string|in:sentence,words',
            'settings.playbackPattern.*.lang' => 'nullable|string|in:en,cn',
            'settings.playbackPattern.*.times' => 'required|integer|min:1|max:10',
        ]);
        if ($validator->fails()) {
            return $this->error(
                __('article.daily_reading_preview_validation', ['message' => $validator->errors()->first()]),
                422
            );
        }

        $validated = $validator->validated();
        $preview = $this->resourceService->preview(
            $user,
            $articleId,
            is_array($validated['settings'] ?? null) ? $validated['settings'] : [],
            isset($validated['group_id']) ? (string) $validated['group_id'] : null
        );
        if ($preview === null) {
            return $this->error(__('article.daily_reading_not_found'), 404);
        }

        return $this->success($preview, __('article.daily_reading_preview_retrieved'));
    }
}
