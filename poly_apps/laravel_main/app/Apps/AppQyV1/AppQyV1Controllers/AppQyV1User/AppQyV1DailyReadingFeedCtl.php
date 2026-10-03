<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailyReadingFeedService;

class AppQyV1DailyReadingFeedCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly AppQyV1DailyReadingFeedService $feedService,
    ) {
    }

    public function feed(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'date' => 'nullable|date_format:Y-m-d',
            'cursor' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:50',
        ]);
        if ($validator->fails()) {
            return $this->error(__('app_qy_v1.messages.validation_failed') . $validator->errors()->first(), 422);
        }

        $user = $request->user('sanctum');
        $data = $this->feedService->feed(
            $user ? (int) $user->id : null,
            $request->filled('date') ? (string) $request->query('date') : null,
            $request->filled('cursor') ? (int) $request->query('cursor') : null,
            (int) $request->query('limit', 20),
        );

        return $this->success($data, __('app_qy_v1.messages.articles_loaded'));
    }

    public function calendar(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);
        if ($validator->fails()) {
            return $this->error(__('app_qy_v1.messages.validation_failed') . $validator->errors()->first(), 422);
        }

        $from = (string) $request->query('from');
        $to = (string) $request->query('to');
        $spanDays = (int) ((strtotime($to) - strtotime($from)) / 86400) + 1;
        if ($spanDays > AppQyV1DailyReadingFeedService::MAX_CALENDAR_DAYS) {
            return $this->error(
                __('app_qy_v1.messages.daily_reading_calendar_range_too_large', [
                    'max' => AppQyV1DailyReadingFeedService::MAX_CALENDAR_DAYS,
                ]),
                422
            );
        }

        $user = $request->user('sanctum');
        $data = $this->feedService->calendar($user ? (int) $user->id : null, $from, $to);

        return $this->success($data, __('app_qy_v1.messages.daily_reading_calendar_retrieved'));
    }

    public function setRead(Request $request, string $articleId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error(__('app_qy_v1.messages.unauthorized'), 401);
        }

        $validator = Validator::make($request->all(), ['read' => 'nullable|boolean']);
        if ($validator->fails()) {
            return $this->error(__('app_qy_v1.messages.validation_failed') . $validator->errors()->first(), 422);
        }

        $result = $this->feedService->setRead((int) $user->id, [$articleId], $request->boolean('read', true));
        if ($result['states'] === []) {
            return $this->notFound(__('app_qy_v1.messages.article_not_found'));
        }

        return $this->success($result, __('app_qy_v1.messages.daily_reading_read_saved'));
    }

    public function setReadBatch(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->error(__('app_qy_v1.messages.unauthorized'), 401);
        }

        $validator = Validator::make($request->all(), [
            'article_ids' => 'required|array|min:1|max:' . AppQyV1DailyReadingFeedService::MAX_BATCH,
            'article_ids.*' => 'required|string|max:255',
            'read' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return $this->error(__('app_qy_v1.messages.validation_failed') . $validator->errors()->first(), 422);
        }

        $result = $this->feedService->setRead(
            (int) $user->id,
            $request->input('article_ids'),
            $request->boolean('read', true)
        );

        return $this->success($result, __('app_qy_v1.messages.daily_reading_read_saved'));
    }
}
