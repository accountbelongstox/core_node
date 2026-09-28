<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

/**
 * Image attached to a post (Social Center expansion §POSTS images[]).
 * image_url is a root-relative '/static/app_qy_v1/post_images/{post_id}/{seq}.jpg'.
 * created_at only (no updated_at).
 */
class AppQyV1PostImageModel extends AppQyV1Model
{
    public $timestamps = false;


    protected ?string $appTableMapKey = 'POST_IMAGES';

    protected $fillable = [
        'post_id',
        'image_url',
        'sequence',
        'caption',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'post_id' => 'integer',
            'sequence' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(AppQyV1PostModel::class, 'post_id');
    }

    public static function orderedForPosts(array $postIds): Collection
    {
        $normalizedIds = [];

        $normalizedIds = array_values(array_unique(array_map('intval', $postIds)));
        if (empty($normalizedIds)) {
            return collect();
        }

        return static::query()
            ->whereIn('post_id', $normalizedIds)
            ->orderBy('post_id')
            ->orderBy('sequence')
            ->orderBy('id')
            ->get();
    }

    public static function storageStateForPost(int $postId): array
    {
        $row = null;

        $row = static::query()
            ->where('post_id', $postId)
            ->selectRaw('COALESCE(MAX(sequence), 0) AS max_sequence, COUNT(*) AS image_count')
            ->first();

        return [
            'max_sequence' => (int) ($row->max_sequence ?? 0),
            'image_count' => (int) ($row->image_count ?? 0),
        ];
    }

    public static function storeForPost(int $postId, array $images): int
    {
        $createdAt = null;
        $rows = [];

        $createdAt = now();
        foreach ($images as $image) {
            $rows[] = [
                'post_id' => $postId,
                'image_url' => (string) $image['image_url'],
                'sequence' => (int) $image['sequence'],
                'caption' => $image['caption'] ?? null,
                'created_at' => $createdAt,
            ];
        }

        if (empty($rows)) {
            return 0;
        }

        static::query()->insert($rows);

        return count($rows);
    }
}
