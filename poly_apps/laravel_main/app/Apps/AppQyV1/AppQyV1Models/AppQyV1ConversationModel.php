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

use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * Chat conversation (SOCIAL_FEATURE_SPECIFICATION.md §1/§2). Direct (1:1) or
 * group; direct threads dedupe via the dkey (min_max user-id pair).
 */
class AppQyV1ConversationModel extends AppQyV1Model
{
    use RunsModelTransactions;
    public const TYPE_DIRECT = 'direct';
    public const TYPE_GROUP = 'group';


    protected ?string $appTableMapKey = 'CONVERSATIONS';

    protected $fillable = [
        'type',
        'created_by',
        'dkey',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'created_by' => 'integer',
            'last_message_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function participants(): HasMany
    {
        return $this->hasMany(AppQyV1ConversationParticipantModel::class, 'conversation_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AppQyV1MessageModel::class, 'conversation_id');
    }

    /** Stable direct-conversation dedupe key for an unordered user pair. */
    public static function directKey(int $a, int $b): string
    {
        $lo = min($a, $b);
        $hi = max($a, $b);
        return $lo . '_' . $hi;
    }

    public static function indexedForIds(array $conversationIds): Collection
    {
        $normalizedIds = [];

        $normalizedIds = array_values(array_unique(array_map('intval', $conversationIds)));
        if (empty($normalizedIds)) {
            return collect();
        }

        return static::query()
            ->whereIn('id', $normalizedIds)
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->get()
            ->keyBy('id');
    }

    public static function findOrCreateDirect(int $firstUserId, int $secondUserId): self
    {
        $directKey = '';
        $existing = null;

        $directKey = self::directKey($firstUserId, $secondUserId);
        $existing = static::query()->where('dkey', $directKey)->first();
        if ($existing) {
            AppQyV1ConversationParticipantModel::ensureUsers(
                (int) $existing->id,
                [$firstUserId, $secondUserId]
            );

            return $existing;
        }

        return static::runInTransaction(function () use ($firstUserId, $secondUserId, $directKey) {
            $conversation = null;

            $conversation = static::query()
                ->where('dkey', $directKey)
                ->lockForUpdate()
                ->first();

            if (!$conversation) {
                $conversation = static::query()->create([
                    'type' => self::TYPE_DIRECT,
                    'created_by' => $firstUserId,
                    'dkey' => $directKey,
                    'last_message_at' => null,
                ]);
            }

            AppQyV1ConversationParticipantModel::ensureUsers(
                (int) $conversation->id,
                [$firstUserId, $secondUserId]
            );

            return $conversation;
        });
    }

    public static function ensureDirect(int $firstUserId, int $secondUserId): void
    {
        try {
            self::findOrCreateDirect($firstUserId, $secondUserId);
        } catch (\Throwable $exception) {
            \Illuminate\Support\Facades\Log::warning('[AppQyV1Social] Direct conversation creation failed', [
                'first_user_id' => $firstUserId,
                'second_user_id' => $secondUserId,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public static function touchLastMessageAt(int $conversationId): int
    {
        return (int) static::query()
            ->where('id', $conversationId)
            ->update(['last_message_at' => now()]);
    }
}
