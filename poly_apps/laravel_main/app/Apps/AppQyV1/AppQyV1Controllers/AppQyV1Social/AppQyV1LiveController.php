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
use App\Models\User;
use App\Services\AvatarService;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LiveSessionModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LiveMessageModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LiveViewerModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserFollowModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;

/**
 * Social Center live (Social Center expansion §LIVE). No native broadcast — a
 * live is an external embed plus SSE chat. SSE live.started -> host's followers;
 * live.chat.new -> current viewers + host (best-effort). users (default conn)
 * merged in PHP; never cross-joined with app_qy_v1_*.
 */
class AppQyV1LiveController extends BaseController
{
    use ApiResponse;

    private const CHAT_DEFAULT_LIMIT = 50;
    private const CHAT_MAX_LIMIT = 100;
    private const LIST_LIMIT = 100;

    /**
     * GET /social/live?status=live|all  -> {items:[Live]}
     */
    public function list(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $status = 'live';
        $builder = null;
        $rows = null;
        $hosts = null;
        $items = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'status' => ['nullable', 'string', 'in:live,all'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $status = (string) $request->query('status', 'live');

        $builder = AppQyV1LiveSessionModel::query();
        if ($status === 'live') {
            $builder->where('status', AppQyV1LiveSessionModel::STATUS_LIVE);
        }
        $rows = $builder->orderByDesc('id')->limit(self::LIST_LIMIT)->get();

        $hosts = $this->usersFor($rows->pluck('host_id')->map(fn ($hid) => (int) $hid)->all());

        foreach ($rows as $row) {
            $items[] = $this->liveShape($row, $hosts);
        }

        return $this->success(['items' => $items]);
    }

    /**
     * POST /social/live {title, description?, external_url?}  -> {Live}
     * Creates a live (status=live, host=current user). SSE live.started to the
     * host's followers.
     */
    public function start(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $title = '';
        $description = null;
        $externalUrl = null;
        $session = null;
        $shape = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'min:1', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'external_url' => ['nullable', 'string', 'max:500'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $title = (string) $request->input('title');
        $description = $request->input('description');
        $externalUrl = $request->input('external_url');

        $session = AppQyV1LiveSessionModel::query()->create([
            'host_id' => $myId,
            'title' => $title,
            'description' => is_string($description) && $description !== '' ? $description : null,
            'status' => AppQyV1LiveSessionModel::STATUS_LIVE,
            'external_url' => is_string($externalUrl) && $externalUrl !== '' ? $externalUrl : null,
            'viewer_count' => 0,
            'started_at' => now(),
            'ended_at' => null,
            'created_at' => now(),
        ]);

        $shape = $this->liveShape($session, $this->usersFor([$myId]));

        $this->fanoutToFollowers($myId, 'live.started', [
            'session_id' => (int) $session->id,
            'host_id' => $myId,
            'live' => $shape,
        ]);

        return $this->success(['live' => $shape], 'Live started');
    }

    /**
     * POST /social/live/{id}/end  -> {Live} (host only, status=ended)
     */
    public function end(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $session = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $session = AppQyV1LiveSessionModel::query()->find($id);
        if (!$session) {
            return $this->notFound('Live session not found');
        }
        if ((int) $session->host_id !== $myId) {
            return $this->forbidden('Only the host can end this live');
        }

        if ((string) $session->status !== AppQyV1LiveSessionModel::STATUS_ENDED) {
            $session->status = AppQyV1LiveSessionModel::STATUS_ENDED;
            $session->ended_at = now();
            $session->save();
        }

        return $this->success([
            'live' => $this->liveShape($session, $this->usersFor([(int) $session->host_id])),
        ], 'Live ended');
    }

    /**
     * POST /social/live/{id}/heartbeat  -> {viewer_count}
     * Records the caller as a current viewer and recomputes viewer_count from
     * recent heartbeats (mirrors the user_presence 60s freshness rule).
     */
    public function heartbeat(Request $request, int $id)
    {
        $currentUser = $request->user();
        $myId = 0;
        $session = null;
        $viewerCount = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $session = AppQyV1LiveSessionModel::query()->find($id);
        if (!$session) {
            return $this->notFound('Live session not found');
        }
        if ((string) $session->status !== AppQyV1LiveSessionModel::STATUS_LIVE) {
            return $this->error('Live session is not active', 422);
        }

        AppQyV1LiveViewerModel::touch($id, $myId);

        $viewerCount = AppQyV1LiveViewerModel::freshViewerCount($id);

        // Materialize the recomputed count on the session.
        if ((int) $session->viewer_count !== $viewerCount) {
            $session->viewer_count = $viewerCount;
            $session->save();
        }

        return $this->success(['viewer_count' => $viewerCount]);
    }

    /**
     * GET /social/live/{id}/chat?cursor=  -> {items:[LiveMsg], next_cursor}
     * Chat ASC after cursor (id-based).
     */
    public function chat(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $cursor = 0;
        $limit = self::CHAT_DEFAULT_LIMIT;
        $session = null;
        $rows = null;
        $users = null;
        $items = [];
        $nextCursor = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:' . self::CHAT_MAX_LIMIT],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $session = AppQyV1LiveSessionModel::query()->find($id);
        if (!$session) {
            return $this->notFound('Live session not found');
        }

        $cursor = (int) $request->query('cursor', 0);
        $limit = (int) $request->query('limit', self::CHAT_DEFAULT_LIMIT);

        $rows = AppQyV1LiveMessageModel::query()
            ->where('session_id', $id)
            ->where('id', '>', $cursor)
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();

        $users = $this->usersFor($rows->pluck('user_id')->map(fn ($uid) => (int) $uid)->all());

        foreach ($rows as $row) {
            $items[] = $this->liveMsgShape($row, $users);
        }
        if (count($items) === $limit && !empty($items)) {
            $nextCursor = (int) $items[count($items) - 1]['id'];
        }

        return $this->success([
            'items' => $items,
            'next_cursor' => $nextCursor,
        ]);
    }

    /**
     * POST /social/live/{id}/chat {body}  -> {LiveMsg}
     * Appends a chat line and emits live.chat.new to current viewers + the host.
     */
    public function sendChat(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $session = null;
        $body = '';
        $message = null;
        $shape = [];
        $recipients = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $validator = Validator::make($request->all(), [
            'body' => ['required', 'string', 'min:1', 'max:2000'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $session = AppQyV1LiveSessionModel::query()->find($id);
        if (!$session) {
            return $this->notFound('Live session not found');
        }
        if ((string) $session->status !== AppQyV1LiveSessionModel::STATUS_LIVE) {
            return $this->error('Live session is not active', 422);
        }

        $body = (string) $request->input('body');

        // A sender is implicitly a viewer; keep their presence fresh.
        AppQyV1LiveViewerModel::touch($id, $myId);

        $message = AppQyV1LiveMessageModel::query()->create([
            'session_id' => $id,
            'user_id' => $myId,
            'body' => $body,
            'created_at' => now(),
        ]);

        $shape = $this->liveMsgShape($message, $this->usersFor([$myId]));

        // Fan out to current viewers + the host (deduped, excluding the sender).
        $recipients = AppQyV1LiveViewerModel::freshViewerIds($id);
        $recipients[] = (int) $session->host_id;
        foreach (array_unique(array_map('intval', $recipients)) as $recipientId) {
            if ($recipientId === $myId) {
                continue;
            }
            AppQyV1SocialEventModel::emit($recipientId, 'live.chat.new', [
                'session_id' => $id,
                'message' => $shape,
            ]);
        }

        return $this->success(['message' => $shape], 'Message sent');
    }

    // ---- Shared helpers ----

    /**
     * Emit $event to every follower of $hostId. Best-effort.
     */
    private function fanoutToFollowers(int $hostId, string $event, array $data): void
    {
        $followerIds = AppQyV1UserFollowModel::query()
            ->where('followed_user_id', $hostId)
            ->pluck('user_id')
            ->map(fn ($uid) => (int) $uid)
            ->all();
        foreach (array_unique($followerIds) as $followerId) {
            if ((int) $followerId === $hostId) {
                continue;
            }
            AppQyV1SocialEventModel::emit((int) $followerId, $event, $data);
        }
    }

    /**
     * Build a {id => User} map (DEFAULT connection) for a set of user ids.
     *
     * @param array<int, int> $userIds
     */
    private function usersFor(array $userIds)
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));
        if (empty($userIds)) {
            return collect();
        }
        return User::whereIn('id', $userIds)
            ->get(['id', 'username', 'nickname', 'name', 'avatar'])
            ->keyBy('id');
    }

    /** FE-facing Live shape. */
    private function liveShape(AppQyV1LiveSessionModel $row, $hosts): array
    {
        $hostUser = $hosts->get((int) $row->host_id);
        return [
            'id' => (int) $row->id,
            'host' => $this->userMini($hostUser, (int) $row->host_id),
            'title' => (string) $row->title,
            'description' => $row->description !== null ? (string) $row->description : null,
            'status' => (string) $row->status,
            'external_url' => $row->external_url !== null ? (string) $row->external_url : null,
            'viewer_count' => (int) $row->viewer_count,
            'started_at' => $row->started_at ? $row->started_at->toISOString() : null,
        ];
    }

    /** FE-facing LiveMsg shape. */
    private function liveMsgShape(AppQyV1LiveMessageModel $row, $users): array
    {
        $msgUser = $users->get((int) $row->user_id);
        return [
            'id' => (int) $row->id,
            'user' => $this->userMini($msgUser, (int) $row->user_id),
            'body' => (string) $row->body,
            'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
        ];
    }

    /**
     * User mini-object {id, name, avatar_url}. Placeholder when the user row is
     * missing so the shape never breaks.
     */
    private function userMini(?User $user, int $fallbackId): array
    {
        if (!$user) {
            return ['id' => $fallbackId, 'name' => 'Unknown', 'avatar_url' => null];
        }
        return [
            'id' => (int) $user->id,
            'name' => $this->displayName($user),
            'avatar_url' => $this->avatarUrl($user),
        ];
    }

    private function displayName(User $user): string
    {
        if (!empty($user->nickname)) {
            return $user->nickname;
        }
        if (!empty($user->name)) {
            return $user->name;
        }
        return (string) $user->username;
    }

    private function avatarUrl(User $user): ?string
    {
        if (!empty($user->avatar)) {
            return AvatarService::getAvatarUrl($user->avatar);
        }
        return null;
    }
}
