<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One like per (post_id, user_id) (Social Center expansion §POSTS like/unlike).
 * UNIQUE on the pair so a like is idempotent. created_at only.
 */
class AppQyV1PostLikeModel extends AppQyV1Model
{
    public $timestamps = false;


    protected ?string $appTableMapKey = 'POST_LIKES';

    protected $fillable = [
        'post_id',
        'user_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'post_id' => 'integer',
            'user_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(AppQyV1PostModel::class, 'post_id');
    }

    /**
     * The subset of $postIds the given user has liked.
     *
     * @param array<int, int> $postIds
     * @return array<int, int>
     */
    public static function likedPostIds(int $userId, array $postIds): array
    {
        if (empty($postIds)) {
            return [];
        }
        return static::query()
            ->where('user_id', $userId)
            ->whereIn('post_id', $postIds)
            ->pluck('post_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
