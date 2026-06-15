<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1UserFollowModel extends Model
{
    use HasFactory;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('USER_FOLLOWS');
    }

    protected $fillable = [
        'user_id',
        'followed_user_id',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'followed_user_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function getFollowedUserIds(int $userId): array
    {
        return self::where('user_id', $userId)
            ->pluck('followed_user_id')
            ->map(function ($id) {
                return (int) $id;
            })
            ->all();
    }

    public static function isFollowing(int $userId, int $followedUserId): bool
    {
        return self::where('user_id', $userId)
            ->where('followed_user_id', $followedUserId)
            ->exists();
    }

    public static function follow(int $userId, int $followedUserId): self
    {
        return self::firstOrCreate([
            'user_id' => $userId,
            'followed_user_id' => $followedUserId,
        ]);
    }

    public static function unfollow(int $userId, int $followedUserId): int
    {
        return self::where('user_id', $userId)
            ->where('followed_user_id', $followedUserId)
            ->delete();
    }
}
