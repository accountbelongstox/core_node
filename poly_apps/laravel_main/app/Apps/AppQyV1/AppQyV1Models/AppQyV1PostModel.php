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
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Collection;

/**
 * Social Center post (Social Center expansion §POSTS). post_type
 * text|images|video|live; like_count / comment_count are materialized counters
 * maintained by the controllers. Soft-deleted so an author can hide a post.
 */
class AppQyV1PostModel extends Model
{
    use RunsModelTransactions, SoftDeletes;

    public const TYPE_TEXT = 'text';
    public const TYPE_IMAGES = 'images';
    public const TYPE_VIDEO = 'video';
    public const TYPE_LIVE = 'live';

    public const VISIBILITY_PUBLIC = 'public';
    public const VISIBILITY_FOLLOWERS = 'followers';
    public const VISIBILITY_PRIVATE = 'private';

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('POSTS');
    }

    protected $fillable = [
        'user_id',
        'content',
        'post_type',
        'video_url',
        'external_url',
        'cover_image_url',
        'visibility',
        'like_count',
        'comment_count',
        'metadata',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'like_count' => 'integer',
        'comment_count' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function images(): HasMany
    {
        return $this->hasMany(AppQyV1PostImageModel::class, 'post_id')
            ->orderBy('sequence')
            ->orderBy('id');
    }

    public function likes(): HasMany
    {
        return $this->hasMany(AppQyV1PostLikeModel::class, 'post_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(AppQyV1PostCommentModel::class, 'post_id');
    }

    public static function timelineForViewer(
        int $viewerId,
        array $followedUserIds,
        int $authorId,
        string $filter,
        int $cursor,
        int $limit
    ): Collection {
        $allowedVisibility = [];
        $query = null;
        $visibleAuthorIds = [];

        $followedUserIds = array_values(array_unique(array_map('intval', $followedUserIds)));
        $query = static::query();

        if ($authorId > 0) {
            $allowedVisibility = [self::VISIBILITY_PUBLIC];
            if ($viewerId === $authorId) {
                $allowedVisibility = [
                    self::VISIBILITY_PUBLIC,
                    self::VISIBILITY_FOLLOWERS,
                    self::VISIBILITY_PRIVATE,
                ];
            } elseif (in_array($authorId, $followedUserIds, true)) {
                $allowedVisibility[] = self::VISIBILITY_FOLLOWERS;
            }

            $query->where('user_id', $authorId)
                ->whereIn('visibility', $allowedVisibility);
        } else {
            $visibleAuthorIds = array_values(array_unique(array_merge($followedUserIds, [$viewerId])));
            $query->where(function ($visibilityQuery) use ($viewerId, $visibleAuthorIds) {
                $visibilityQuery
                    ->where('user_id', $viewerId)
                    ->orWhere(function ($followedQuery) use ($visibleAuthorIds) {
                        $followedQuery
                            ->whereIn('user_id', $visibleAuthorIds)
                            ->whereIn('visibility', [
                                self::VISIBILITY_PUBLIC,
                                self::VISIBILITY_FOLLOWERS,
                            ]);
                    })
                    ->orWhere('visibility', self::VISIBILITY_PUBLIC);
            });
        }

        if ($authorId <= 0 && $filter === 'following') {
            $query->whereIn('user_id', $followedUserIds);
        } elseif ($filter === 'images') {
            $query->where('post_type', self::TYPE_IMAGES);
        } elseif ($filter === 'videos') {
            $query->where('post_type', self::TYPE_VIDEO);
        }

        if ($cursor > 0) {
            $query->where('id', '<', $cursor);
        }

        return $query->orderByDesc('id')->limit($limit)->get();
    }

    public static function createForUser(
        int $userId,
        ?string $content,
        string $postType,
        ?string $externalUrl,
        string $visibility
    ): self {
        return static::query()->create([
            'user_id' => $userId,
            'content' => $content,
            'post_type' => $postType,
            'external_url' => $externalUrl,
            'visibility' => $visibility,
            'like_count' => 0,
            'comment_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public static function findPost(int $postId): ?self
    {
        return static::query()->find($postId);
    }

    public static function visibleCountForViewer(
        int $authorId,
        int $viewerId,
        array $viewerFollowedIds
    ): int {
        $allowedVisibility = [];

        if ($viewerId === $authorId) {
            $allowedVisibility = [
                self::VISIBILITY_PUBLIC,
                self::VISIBILITY_FOLLOWERS,
                self::VISIBILITY_PRIVATE,
            ];
        } else {
            $allowedVisibility = [self::VISIBILITY_PUBLIC];
            if (in_array($authorId, array_map('intval', $viewerFollowedIds), true)) {
                $allowedVisibility[] = self::VISIBILITY_FOLLOWERS;
            }
        }

        return (int) static::query()
            ->where('user_id', $authorId)
            ->whereIn('visibility', $allowedVisibility)
            ->count();
    }

    public function canBeViewedBy(int $userId): bool
    {
        $authorId = 0;
        $visibility = '';

        $authorId = (int) $this->user_id;
        if ($authorId === $userId) {
            return true;
        }

        $visibility = (string) $this->visibility;
        if ($visibility === self::VISIBILITY_PUBLIC) {
            return true;
        }
        if ($visibility === self::VISIBILITY_FOLLOWERS) {
            return AppQyV1UserFollowModel::isFollowing($userId, $authorId);
        }

        return false;
    }

    public function deletePost(): bool
    {
        return (bool) $this->delete();
    }

    public function promoteToImages(): void
    {
        if ((string) $this->post_type !== self::TYPE_TEXT) {
            return;
        }

        $this->post_type = self::TYPE_IMAGES;
        $this->updated_at = now();
        $this->save();
    }

    public function attachVideo(string $videoUrl): void
    {
        $this->video_url = $videoUrl;
        $this->post_type = self::TYPE_VIDEO;
        $this->updated_at = now();
        $this->save();
    }

    public function registerLike(int $userId): array
    {
        $postId = 0;

        $postId = (int) $this->id;

        return static::runInTransaction(function () use ($postId, $userId) {
            $like = null;
            $post = null;

            $post = static::query()->where('id', $postId)->lockForUpdate()->firstOrFail();
            $like = AppQyV1PostLikeModel::query()->firstOrCreate(
                ['post_id' => $postId, 'user_id' => $userId],
                ['created_at' => now()]
            );

            if ($like->wasRecentlyCreated) {
                $post->increment('like_count');
                $post->refresh();
            }

            return [
                'was_created' => $like->wasRecentlyCreated,
                'like_count' => (int) $post->like_count,
            ];
        });
    }

    public function removeLike(int $userId): array
    {
        $postId = 0;

        $postId = (int) $this->id;

        return static::runInTransaction(function () use ($postId, $userId) {
            $deleted = 0;
            $post = null;

            $post = static::query()->where('id', $postId)->lockForUpdate()->firstOrFail();
            $deleted = AppQyV1PostLikeModel::query()
                ->where('post_id', $postId)
                ->where('user_id', $userId)
                ->delete();

            if ($deleted > 0 && (int) $post->like_count > 0) {
                $post->decrement('like_count');
                $post->refresh();
            }

            return [
                'was_deleted' => $deleted > 0,
                'like_count' => (int) $post->like_count,
            ];
        });
    }
}
