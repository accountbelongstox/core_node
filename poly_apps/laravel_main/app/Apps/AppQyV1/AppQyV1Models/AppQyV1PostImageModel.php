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
 * Image attached to a post (Social Center expansion §POSTS images[]).
 * image_url is a root-relative '/static/app_qy_v1/post_images/{post_id}/{seq}.jpg'.
 * created_at only (no updated_at).
 */
class AppQyV1PostImageModel extends Model
{
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('POST_IMAGES');
    }

    protected $fillable = [
        'post_id',
        'image_url',
        'sequence',
        'caption',
        'created_at',
    ];

    protected $casts = [
        'post_id' => 'integer',
        'sequence' => 'integer',
        'created_at' => 'datetime',
    ];

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
