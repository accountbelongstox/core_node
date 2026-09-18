<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1NotificationModel;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeMartV1NotificationCtl extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $page = max(1, (int) $request->query('page', 1));
        $pageSize = min(
            CodeMartV1Constants::MAX_PAGE_SIZE,
            max(1, (int) $request->query('page_size', CodeMartV1Constants::DEFAULT_PAGE_SIZE))
        );

        $result = CodeMartV1NotificationModel::pageForUser((int) $user->id, $page, $pageSize);

        return $this->success([
            'items' => $result['notifications']->map(
                static fn (CodeMartV1NotificationModel $notification): array => [
                    'id' => $notification->id,
                    'type' => $notification->type,
                    'title_key' => $notification->title_key,
                    'body_key' => $notification->body_key,
                    'params' => $notification->params,
                    'resource_type' => $notification->resource_type,
                    'resource_id' => $notification->resource_id,
                    'read' => $notification->read_at !== null,
                    'created_at' => $notification->created_at?->toIso8601String(),
                ]
            )->all(),
            'total' => $result['total'],
            'page' => $page,
            'page_size' => $pageSize,
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        return $this->success([
            'unread' => CodeMartV1NotificationModel::unreadCountForUser((int) $user->id),
        ]);
    }

    public function markRead(Request $request, int $notificationId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        CodeMartV1NotificationModel::markReadForUser((int) $user->id, $notificationId);

        return $this->success([
            'unread' => CodeMartV1NotificationModel::unreadCountForUser((int) $user->id),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        CodeMartV1NotificationModel::markAllReadForUser((int) $user->id);

        return $this->success(['unread' => 0]);
    }
}
