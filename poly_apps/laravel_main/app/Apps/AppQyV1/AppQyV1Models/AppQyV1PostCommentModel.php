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
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Collection;

/**
 * Post comment (Social Center expansion §POSTS comments). One-level threading
 * via parent_comment_id. Soft-deleted so removing a comment never breaks ids.
 * created_at only for inserts (no updated_at column); SoftDeletes adds deleted_at.
 */
class AppQyV1PostCommentModel extends Model
{
    use SoftDeletes;

    public const UPDATED_AT = null;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('POST_COMMENTS');
    }

    protected $fillable = [
        'post_id',
        'user_id',
        'parent_comment_id',
        'body',
        'created_at',
    ];

    protected $casts = [
        'post_id' => 'integer',
        'user_id' => 'integer',
        'parent_comment_id' => 'integer',
        'created_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(AppQyV1PostModel::class, 'post_id');
    }

    public function parentComment(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_comment_id');
    }

    public static function afterCursor(int $postId, int $cursor, int $limit): Collection
    {
        return static::query()
            ->where('post_id', $postId)
            ->where('id', '>', $cursor)
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function findOnPost(int $commentId, int $postId): ?self
    {
        return static::query()
            ->where('id', $commentId)
            ->where('post_id', $postId)
            ->first();
    }

    public static function createForPost(
        int $postId,
        int $userId,
        string $body,
        ?int $parentCommentId
    ): self {
        return AppQyV1PostModel::runInTransaction(function () use (
            $postId,
            $userId,
            $body,
            $parentCommentId
        ) {
            $comment = null;
            $post = null;

            $post = AppQyV1PostModel::query()->where('id', $postId)->lockForUpdate()->firstOrFail();
            $comment = static::query()->create([
                'post_id' => $postId,
                'user_id' => $userId,
                'parent_comment_id' => $parentCommentId,
                'body' => $body,
                'created_at' => now(),
            ]);
            $post->increment('comment_count');

            return $comment;
        });
    }

    public function deleteFromPost(): bool
    {
        $commentId = 0;
        $postId = 0;

        $commentId = (int) $this->id;
        $postId = (int) $this->post_id;

        return AppQyV1PostModel::runInTransaction(function () use ($commentId, $postId) {
            $comment = null;
            $post = null;

            $post = AppQyV1PostModel::query()->where('id', $postId)->lockForUpdate()->firstOrFail();
            $comment = static::query()->where('id', $commentId)->firstOrFail();
            $comment->delete();

            if ((int) $post->comment_count > 0) {
                $post->decrement('comment_count');
            }

            return true;
        });
    }
}
