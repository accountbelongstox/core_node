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

/**
 * One like per (post_id, user_id) (Social Center expansion §POSTS like/unlike).
 * UNIQUE on the pair so a like is idempotent. created_at only.
 */
class AppQyV1PostLikeModel extends Model
{
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('POST_LIKES');
    }

    protected $fillable = [
        'post_id',
        'user_id',
        'created_at',
    ];

    protected $casts = [
        'post_id' => 'integer',
        'user_id' => 'integer',
        'created_at' => 'datetime',
    ];

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
