<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1NotificationModel;

/**
 * Notification inbox (SOCIAL_FEATURE_SPECIFICATION.md §3). Always scoped to the
 * authenticated user — every query is keyed on $request->user()->id.
 */
class AppQyV1NotificationController extends Controller
{
    use ApiResponse;

    private const DEFAULT_LIMIT = 30;
    private const MAX_LIMIT = 100;

    /**
     * GET /social/notifications?cursor=&unread=
     * Newest-first; cursor is an id (return rows with id < cursor for older).
     */
    public function index(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $cursor = 0;
        $limit = self::DEFAULT_LIMIT;
        $unreadOnly = false;
        $rows = null;
        $items = [];
        $nextCursor = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:' . self::MAX_LIMIT],
            'unread' => ['nullable'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $cursor = (int) $request->query('cursor', 0);
        $limit = (int) $request->query('limit', self::DEFAULT_LIMIT);
        $unreadOnly = filter_var($request->query('unread', false), FILTER_VALIDATE_BOOLEAN);

        $rows = AppQyV1NotificationModel::inboxForUser(
            (int) $currentUser->id,
            $cursor,
            $unreadOnly,
            $limit
        );

        foreach ($rows as $row) {
            $items[] = [
                'id' => (int) $row->id,
                'type' => (string) $row->type,
                'payload' => is_array($row->payload) ? $row->payload : [],
                'read_at' => $row->read_at ? $row->read_at->toISOString() : null,
                'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
            ];
        }

        if (count($items) === $limit && !empty($items)) {
            $nextCursor = (int) $items[count($items) - 1]['id'];
        }

        return $this->success([
            'notifications' => $items,
            'next_cursor' => $nextCursor,
        ]);
    }

    /**
     * GET /social/notifications/unread-count -> { count }
     */
    public function unreadCount(Request $request)
    {
        $currentUser = $request->user();
        $count = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $count = AppQyV1NotificationModel::unreadCountForUser((int) $currentUser->id);

        return $this->success(['count' => $count]);
    }

    /**
     * POST /social/notifications/read {id} or {all:true}
     */
    public function markRead(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $all = false;
        $id = 0;
        $updated = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'id' => ['nullable', 'integer', 'min:1'],
            'all' => ['nullable'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $all = filter_var($request->input('all', false), FILTER_VALIDATE_BOOLEAN);
        $id = (int) $request->input('id', 0);

        if (!$all && $id <= 0) {
            return $this->error(__('app_qy_v1.messages.provide_a_notification_id_or_all_true'), 422);
        }

        $updated = AppQyV1NotificationModel::markReadForUser(
            (int) $currentUser->id,
            $all ? null : $id
        );

        return $this->success(['updated' => $updated], __('app_qy_v1.messages.notifications_marked_read'));
    }
}
