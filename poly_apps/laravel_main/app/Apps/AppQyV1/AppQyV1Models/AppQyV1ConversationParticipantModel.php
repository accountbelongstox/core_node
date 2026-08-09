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

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Collection;

/**
 * Conversation membership (SOCIAL_FEATURE_SPECIFICATION.md §1/§2). The caller's
 * row in this table is the authorization check for every message endpoint;
 * last_read_message_id drives unread counts. No updated_at (joined_at only).
 */
class AppQyV1ConversationParticipantModel extends Model
{
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('CONVERSATION_PARTICIPANTS');
    }

    protected $fillable = [
        'conversation_id',
        'user_id',
        'last_read_message_id',
        'joined_at',
    ];

    protected $casts = [
        'conversation_id' => 'integer',
        'user_id' => 'integer',
        'last_read_message_id' => 'integer',
        'joined_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AppQyV1ConversationModel::class, 'conversation_id');
    }

    public static function participationsForUser(int $userId): Collection
    {
        return static::query()
            ->where('user_id', $userId)
            ->get(['conversation_id', 'last_read_message_id']);
    }

    public static function peersForConversations(array $conversationIds, int $userId): Collection
    {
        $normalizedIds = [];

        $normalizedIds = array_values(array_unique(array_map('intval', $conversationIds)));
        if (empty($normalizedIds)) {
            return collect();
        }

        return static::query()
            ->whereIn('conversation_id', $normalizedIds)
            ->where('user_id', '!=', $userId)
            ->get(['conversation_id', 'user_id']);
    }

    public static function ensureUsers(int $conversationId, array $userIds): void
    {
        $joinedAt = null;
        $normalizedIds = [];
        $rows = [];

        $joinedAt = now();
        $normalizedIds = array_values(array_unique(array_map('intval', $userIds)));
        foreach ($normalizedIds as $userId) {
            $rows[] = [
                'conversation_id' => $conversationId,
                'user_id' => $userId,
                'last_read_message_id' => null,
                'joined_at' => $joinedAt,
            ];
        }

        if (!empty($rows)) {
            static::query()->insertOrIgnore($rows);
        }
    }

    public static function markRead(int $conversationId, int $userId, int $messageId): int
    {
        return (int) static::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->update(['last_read_message_id' => $messageId]);
    }

    /** Whether $userId is a participant of $conversationId (the chat auth check). */
    public static function isParticipant(int $conversationId, int $userId): bool
    {
        return static::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->exists();
    }

    /**
     * Other participant user ids of a conversation (everyone except $userId).
     *
     * @return array<int, int>
     */
    public static function otherParticipantIds(int $conversationId, int $userId): array
    {
        return static::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', '!=', $userId)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
