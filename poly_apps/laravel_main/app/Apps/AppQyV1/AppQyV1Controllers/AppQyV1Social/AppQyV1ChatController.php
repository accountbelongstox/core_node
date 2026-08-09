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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ConversationModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ConversationParticipantModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MessageModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserPresenceModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1NotificationModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;

/**
 * 1:1 chat (SOCIAL_FEATURE_SPECIFICATION.md §3 CHAT). Every conversation/message
 * endpoint verifies the caller is a participant. Direct threads dedupe via dkey.
 * users (default conn) and app_qy_v1_* (appqyv1 conn) are queried separately and
 * merged in PHP — never cross-joined.
 */
class AppQyV1ChatController extends BaseController
{
    use ApiResponse;

    private const MSG_DEFAULT_LIMIT = 50;
    private const MSG_MAX_LIMIT = 100;

    /**
     * GET /social/conversations
     * My conversations with peer info, last message, unread count.
     */
    public function index(Request $request)
    {
        $currentUser = $request->user();
        $myId = 0;
        $myRows = null;
        $convIds = [];
        $convs = null;
        $partRows = null;
        $peerIdByConv = [];
        $myReadByConv = [];
        $peerUserIds = [];
        $users = null;
        $presence = [];
        $lastMsgByConv = [];
        $unreadByConv = [];
        $out = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        // My participations -> conversation ids + my last_read marker.
        $myRows = AppQyV1ConversationParticipantModel::participationsForUser($myId);
        foreach ($myRows as $row) {
            $cid = (int) $row->conversation_id;
            $convIds[$cid] = $cid;
            $myReadByConv[$cid] = (int) ($row->last_read_message_id ?? 0);
        }
        $convIds = array_values($convIds);
        if (empty($convIds)) {
            return $this->success(['conversations' => []]);
        }

        $convs = AppQyV1ConversationModel::indexedForIds($convIds);

        // Direct-conversation peers (the OTHER participant per conversation).
        $partRows = AppQyV1ConversationParticipantModel::peersForConversations($convIds, $myId);
        foreach ($partRows as $row) {
            $peerIdByConv[(int) $row->conversation_id] = (int) $row->user_id;
            $peerUserIds[(int) $row->user_id] = (int) $row->user_id;
        }
        $peerUserIds = array_values($peerUserIds);

        $users = User::indexedByIds($peerUserIds, ['id', 'username', 'nickname', 'name', 'avatar']);
        $presence = AppQyV1UserPresenceModel::effectiveFor($peerUserIds);

        $lastMsgByConv = AppQyV1MessageModel::latestForConversations($convIds);

        // Unread per conversation = messages with id > my last_read, not mine.
        $unreadByConv = AppQyV1MessageModel::unreadCounts($convIds, $myId, $myReadByConv);

        foreach ($convIds as $cid) {
            $conv = $convs->get($cid);
            if (!$conv) {
                continue;
            }
            $peerId = $peerIdByConv[$cid] ?? null;
            $peerUser = $peerId !== null ? $users->get($peerId) : null;
            $lastMsgRow = $lastMsgByConv->get($cid);
            $lastMsg = $lastMsgRow ? $this->messageShape($lastMsgRow) : null;

            $out[] = [
                'id' => (int) $conv->id,
                'type' => (string) $conv->type,
                'peer' => $peerUser ? [
                    'id' => (int) $peerUser->id,
                    'nickname' => $this->displayName($peerUser),
                    'avatar' => $this->avatarUrl($peerUser),
                    'presence' => $presence[$peerId] ?? ['status' => 'offline', 'last_seen_at' => null],
                ] : null,
                'last_message' => $lastMsg,
                'unread_count' => (int) ($unreadByConv[$cid] ?? 0),
                'last_message_at' => $conv->last_message_at ? $conv->last_message_at->toISOString() : null,
            ];
        }

        return $this->success(['conversations' => $out]);
    }

    /**
     * POST /social/conversations {user_id}
     * Get-or-create the DIRECT conversation with another user (idempotent on dkey).
     */
    public function open(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $peerId = 0;
        $peerUser = null;
        $conv = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $myId = (int) $currentUser->id;
        $peerId = (int) $request->input('user_id');
        if ($peerId === $myId) {
            return $this->error('Cannot open a conversation with yourself', 422);
        }

        $peerUser = User::findById($peerId);
        if (!$peerUser) {
            return $this->notFound('User not found');
        }

        $conv = AppQyV1ConversationModel::findOrCreateDirect($myId, $peerId);

        return $this->success([
            'conversation' => [
                'id' => (int) $conv->id,
                'type' => (string) $conv->type,
                'peer' => [
                    'id' => (int) $peerUser->id,
                    'nickname' => $this->displayName($peerUser),
                    'avatar' => $this->avatarUrl($peerUser),
                ],
            ],
        ]);
    }

    /**
     * GET /social/conversations/{id}/messages?cursor=&limit=
     * Messages ASC after cursor (id-based). Caller MUST be a participant.
     */
    public function messages(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $cursor = 0;
        $limit = self::MSG_DEFAULT_LIMIT;
        $rows = null;
        $items = [];
        $nextCursor = null;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        if (!AppQyV1ConversationParticipantModel::isParticipant($id, (int) $currentUser->id)) {
            return $this->forbidden('Not a participant of this conversation');
        }

        $validator = Validator::make($request->all(), [
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:' . self::MSG_MAX_LIMIT],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $cursor = (int) $request->query('cursor', 0);
        $limit = (int) $request->query('limit', self::MSG_DEFAULT_LIMIT);

        $rows = AppQyV1MessageModel::afterCursor($id, $cursor, $limit);

        foreach ($rows as $row) {
            $items[] = $this->messageShape($row);
        }
        if (count($items) === $limit && !empty($items)) {
            $nextCursor = (int) $items[count($items) - 1]['id'];
        }

        return $this->success([
            'messages' => $items,
            'next_cursor' => $nextCursor,
        ]);
    }

    /**
     * POST /social/conversations/{id}/messages {body, type?, metadata?}
     * Insert message; bump last_message_at; SSE message.new + new_message
     * notification to the OTHER participant(s). Caller MUST be a participant.
     */
    public function send(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $body = '';
        $type = AppQyV1MessageModel::TYPE_TEXT;
        $metadata = null;
        $message = null;
        $shape = [];
        $others = [];
        $senderName = '';

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;
        if (!AppQyV1ConversationParticipantModel::isParticipant($id, $myId)) {
            return $this->forbidden('Not a participant of this conversation');
        }

        $validator = Validator::make($request->all(), [
            'body' => ['required', 'string', 'min:1', 'max:5000'],
            'type' => ['nullable', 'string', 'in:text,image,voice'],
            'metadata' => ['nullable', 'array'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $body = (string) $request->input('body');
        $type = (string) $request->input('type', AppQyV1MessageModel::TYPE_TEXT);
        $metadata = $request->input('metadata');

        $message = AppQyV1MessageModel::appendToConversation(
            $id,
            $myId,
            $body,
            $type,
            is_array($metadata) ? $metadata : null
        );

        $shape = $this->messageShape($message);

        // Notify + SSE the other participant(s). Best-effort — never break the send.
        $others = AppQyV1ConversationParticipantModel::otherParticipantIds($id, $myId);
        $senderName = $this->displayName($currentUser);
        foreach ($others as $otherId) {
            AppQyV1SocialEventModel::emit($otherId, 'message.new', [
                'conversation_id' => $id,
                'message' => $shape,
            ]);
            $notifId = AppQyV1NotificationModel::notify($otherId, 'new_message', [
                'conversation_id' => $id,
                'message_id' => (int) $message->id,
                'sender_id' => $myId,
                'sender_name' => $senderName,
                'preview' => mb_substr($body, 0, 120),
            ]);
            if ($notifId > 0) {
                AppQyV1SocialEventModel::emit($otherId, 'notification.new', [
                    'id' => $notifId,
                    'type' => 'new_message',
                    'conversation_id' => $id,
                ]);
            }
        }

        return $this->success(['message' => $shape], 'Message sent');
    }

    /**
     * POST /social/conversations/{id}/read {message_id}
     * Set the caller's last_read_message_id. Caller MUST be a participant.
     */
    public function read(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $messageId = 0;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        if (!AppQyV1ConversationParticipantModel::isParticipant($id, (int) $currentUser->id)) {
            return $this->forbidden('Not a participant of this conversation');
        }

        $validator = Validator::make($request->all(), [
            'message_id' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $messageId = (int) $request->input('message_id');

        AppQyV1ConversationParticipantModel::markRead(
            $id,
            (int) $currentUser->id,
            $messageId
        );

        return $this->success(['conversation_id' => $id, 'last_read_message_id' => $messageId], 'Read marker updated');
    }

    /** FE-facing message shape. */
    private function messageShape(AppQyV1MessageModel $row): array
    {
        return [
            'id' => (int) $row->id,
            'conversation_id' => (int) $row->conversation_id,
            'sender_id' => (int) $row->sender_id,
            'body' => (string) $row->body,
            'type' => (string) $row->type,
            'metadata' => is_array($row->metadata) ? $row->metadata : null,
            'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
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
