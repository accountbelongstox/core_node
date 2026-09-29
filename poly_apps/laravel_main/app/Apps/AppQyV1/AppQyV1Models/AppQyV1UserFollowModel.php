<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Collection;

class AppQyV1UserFollowModel extends AppQyV1Model
{
    use HasFactory;


    protected ?string $appTableMapKey = 'USER_FOLLOWS';

    protected $fillable = [
        'user_id',
        'followed_user_id',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'followed_user_id' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function rowsForUser(int $userId): Collection
    {
        return static::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get();
    }

    public static function countsForUser(int $userId): array
    {
        $row = null;

        $row = static::query()
            ->where(function ($query) use ($userId) {
                $query->where('user_id', $userId)
                    ->orWhere('followed_user_id', $userId);
            })
            ->selectRaw('SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS following_count', [$userId])
            ->selectRaw('SUM(CASE WHEN followed_user_id = ? THEN 1 ELSE 0 END) AS follower_count', [$userId])
            ->first();

        return [
            'following_count' => (int) ($row->following_count ?? 0),
            'follower_count' => (int) ($row->follower_count ?? 0),
        ];
    }

    public static function getFollowedUserIds(int $userId): array
    {
        return static::query()->where('user_id', $userId)
            ->pluck('followed_user_id')
            ->map(function ($id) {
                return (int) $id;
            })
            ->all();
    }

    public static function isFollowing(int $userId, int $followedUserId): bool
    {
        return static::query()->where('user_id', $userId)
            ->where('followed_user_id', $followedUserId)
            ->exists();
    }

    public static function followerUserIds(int $followedUserId): array
    {
        $ids = [];

        $ids = static::query()
            ->where('followed_user_id', $followedUserId)
            ->pluck('user_id')
            ->map(fn ($userId) => (int) $userId)
            ->all();

        return array_values(array_unique($ids));
    }

    public static function follow(int $userId, int $followedUserId): self
    {
        return static::query()->firstOrCreate([
            'user_id' => $userId,
            'followed_user_id' => $followedUserId,
        ]);
    }

    public static function unfollow(int $userId, int $followedUserId): int
    {
        return static::query()->where('user_id', $userId)
            ->where('followed_user_id', $followedUserId)
            ->delete();
    }
}
