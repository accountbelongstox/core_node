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

use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Collection;

/**
 * Chat message (SOCIAL_FEATURE_SPECIFICATION.md §1/§2). Append-only;
 * created_at only (no updated_at). Paginated by the (conversation_id, id) cursor.
 */
class AppQyV1MessageModel extends Model
{
    public const TYPE_TEXT = 'text';
    public const TYPE_IMAGE = 'image';
    public const TYPE_VOICE = 'voice';

    // created_at only (append-only); no updated_at column.
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('MESSAGES');
    }

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'type',
        'metadata',
        'created_at',
    ];

    protected $casts = [
        'conversation_id' => 'integer',
        'sender_id' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AppQyV1ConversationModel::class, 'conversation_id');
    }

    public static function afterCursor(int $conversationId, int $cursor, int $limit): Collection
    {
        return static::query()
            ->where('conversation_id', $conversationId)
            ->where('id', '>', $cursor)
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function appendToConversation(
        int $conversationId,
        int $senderId,
        string $body,
        string $type,
        ?array $metadata
    ): self {
        return AppQyV1ConversationModel::runInTransaction(function () use (
            $conversationId,
            $senderId,
            $body,
            $type,
            $metadata
        ) {
            $message = null;

            $message = static::query()->create([
                'conversation_id' => $conversationId,
                'sender_id' => $senderId,
                'body' => $body,
                'type' => $type,
                'metadata' => $metadata,
                'created_at' => now(),
            ]);
            AppQyV1ConversationModel::touchLastMessageAt($conversationId);

            return $message;
        });
    }

    public static function latestForConversations(array $conversationIds): Collection
    {
        $latestIds = null;
        $normalizedIds = [];

        $normalizedIds = array_values(array_unique(array_map('intval', $conversationIds)));
        if (empty($normalizedIds)) {
            return collect();
        }

        $latestIds = static::query()
            ->whereIn('conversation_id', $normalizedIds)
            ->groupBy('conversation_id')
            ->selectRaw('MAX(id)');

        return static::query()
            ->whereIn('id', $latestIds)
            ->get()
            ->keyBy('conversation_id');
    }

    public static function unreadCounts(
        array $conversationIds,
        int $userId,
        array $lastReadByConversation
    ): array {
        $counts = [];
        $normalizedIds = [];
        $rows = null;

        $normalizedIds = array_values(array_unique(array_map('intval', $conversationIds)));
        if (empty($normalizedIds)) {
            return $counts;
        }

        $rows = static::query()
            ->select('conversation_id')
            ->selectRaw('COUNT(*) AS unread_count')
            ->whereIn('conversation_id', $normalizedIds)
            ->where('sender_id', '!=', $userId)
            ->where(function ($query) use ($lastReadByConversation) {
                foreach ($lastReadByConversation as $conversationId => $lastReadMessageId) {
                    $query->orWhere(function ($conversationQuery) use ($conversationId, $lastReadMessageId) {
                        $conversationQuery
                            ->where('conversation_id', (int) $conversationId)
                            ->where('id', '>', (int) $lastReadMessageId);
                    });
                }
            })
            ->groupBy('conversation_id')
            ->get();

        foreach ($rows as $row) {
            $counts[(int) $row->conversation_id] = (int) $row->unread_count;
        }

        return $counts;
    }
}
