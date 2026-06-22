<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Routing\Controller as BaseController;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1NotificationModel;

/**
 * Notification inbox (SOCIAL_FEATURE_SPECIFICATION.md §3). Always scoped to the
 * authenticated user — every query is keyed on $request->user()->id.
 */
class AppQyV1NotificationController extends BaseController
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
        $query = null;
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

        $query = AppQyV1NotificationModel::query()
            ->where('user_id', (int) $currentUser->id)
            ->orderByDesc('id');

        // Newest-first: a cursor is the smallest id already seen; fetch older.
        if ($cursor > 0) {
            $query->where('id', '<', $cursor);
        }
        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        $rows = $query->limit($limit)->get();

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

        $count = (int) AppQyV1NotificationModel::query()
            ->where('user_id', (int) $currentUser->id)
            ->whereNull('read_at')
            ->count();

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
            return $this->error('Provide a notification id or all:true', 422);
        }

        $query = AppQyV1NotificationModel::query()
            ->where('user_id', (int) $currentUser->id)
            ->whereNull('read_at');

        if (!$all) {
            $query->where('id', $id);
        }

        $updated = (int) $query->update(['read_at' => now()]);

        return $this->success(['updated' => $updated], 'Notifications marked read');
    }
}
