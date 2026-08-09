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
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Collection;

/**
 * Two-way friend request (SOCIAL_FEATURE_SPECIFICATION.md §1/§2). Kept alongside
 * the one-way user_follows. status pending|accepted|rejected|blocked, unique per
 * (requester_id, addressee_id).
 */
class AppQyV1FriendRequestModel extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_BLOCKED = 'blocked';

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('FRIEND_REQUESTS');
    }

    protected $fillable = [
        'requester_id',
        'addressee_id',
        'status',
    ];

    protected $casts = [
        'requester_id' => 'integer',
        'addressee_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function sendOrReset(int $requesterId, int $addresseeId): self
    {
        $request = null;

        $request = static::query()->firstOrCreate(
            ['requester_id' => $requesterId, 'addressee_id' => $addresseeId],
            ['status' => self::STATUS_PENDING]
        );

        if ((string) $request->status === self::STATUS_REJECTED) {
            $request->status = self::STATUS_PENDING;
            $request->save();
        }

        return $request;
    }

    public static function findRequest(int $requestId): ?self
    {
        return static::query()->find($requestId);
    }

    public function acceptRequest(): self
    {
        $this->status = self::STATUS_ACCEPTED;
        $this->save();

        return $this;
    }

    public function rejectRequest(): self
    {
        $this->status = self::STATUS_REJECTED;
        $this->save();

        return $this;
    }

    public static function pendingForUser(int $userId, string $direction): Collection
    {
        $query = null;

        $query = static::query()->where('status', self::STATUS_PENDING);
        if ($direction === 'incoming') {
            $query->where('addressee_id', $userId);
        } else {
            $query->where('requester_id', $userId);
        }

        return $query->orderByDesc('id')->get();
    }

    public static function blockPair(int $blockerId, int $blockedUserId): self
    {
        $request = null;

        $request = static::query()
            ->where(function ($query) use ($blockerId, $blockedUserId) {
                $query
                    ->where(function ($forwardQuery) use ($blockerId, $blockedUserId) {
                        $forwardQuery
                            ->where('requester_id', $blockerId)
                            ->where('addressee_id', $blockedUserId);
                    })
                    ->orWhere(function ($reverseQuery) use ($blockerId, $blockedUserId) {
                        $reverseQuery
                            ->where('requester_id', $blockedUserId)
                            ->where('addressee_id', $blockerId);
                    });
            })
            ->first();

        if (!$request) {
            return static::query()->create([
                'requester_id' => $blockerId,
                'addressee_id' => $blockedUserId,
                'status' => self::STATUS_BLOCKED,
            ]);
        }

        $request->status = self::STATUS_BLOCKED;
        $request->save();

        return $request;
    }

    /**
     * The set of user ids that are ACCEPTED friends of $userId (either direction).
     *
     * @return array<int, int>
     */
    public static function acceptedFriendIds(int $userId): array
    {
        $rows = static::query()
            ->where('status', self::STATUS_ACCEPTED)
            ->where(function ($q) use ($userId) {
                $q->where('requester_id', $userId)->orWhere('addressee_id', $userId);
            })
            ->get(['requester_id', 'addressee_id']);

        $ids = [];
        foreach ($rows as $row) {
            $other = (int) $row->requester_id === $userId ? (int) $row->addressee_id : (int) $row->requester_id;
            $ids[$other] = $other;
        }
        return array_values($ids);
    }

    /**
     * The set of user ids in a blocked relationship with $userId (either side).
     *
     * @return array<int, int>
     */
    public static function blockedIds(int $userId): array
    {
        $rows = static::query()
            ->where('status', self::STATUS_BLOCKED)
            ->where(function ($q) use ($userId) {
                $q->where('requester_id', $userId)->orWhere('addressee_id', $userId);
            })
            ->get(['requester_id', 'addressee_id']);

        $ids = [];
        foreach ($rows as $row) {
            $other = (int) $row->requester_id === $userId ? (int) $row->addressee_id : (int) $row->requester_id;
            $ids[$other] = $other;
        }
        return array_values($ids);
    }

    /** Whether $a and $b are accepted friends (either direction). */
    public static function areFriends(int $a, int $b): bool
    {
        return static::query()
            ->where('status', self::STATUS_ACCEPTED)
            ->where(function ($q) use ($a, $b) {
                $q->where(function ($q2) use ($a, $b) {
                    $q2->where('requester_id', $a)->where('addressee_id', $b);
                })->orWhere(function ($q2) use ($a, $b) {
                    $q2->where('requester_id', $b)->where('addressee_id', $a);
                });
            })
            ->exists();
    }
}
