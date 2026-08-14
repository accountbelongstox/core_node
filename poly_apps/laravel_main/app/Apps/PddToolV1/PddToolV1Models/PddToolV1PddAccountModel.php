<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Models;

use App\Models\Model;
use Illuminate\Support\Collection;
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * A PDD platform account bound by a member (cookie + access token + profile).
 */
class PddToolV1PddAccountModel extends Model
{
    protected $appKey = AppKeys::PDDTOOLV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = PddToolV1TableMaps::getTableName('PDD_ACCOUNTS');
    }

    protected $fillable = [
        'user_id',
        'pdd_user_id',
        'pdd_name',
        'pdd_avatar',
        'pdd_access_token',
        'pdd_cookie',
        'mobile_bind',
        'dd_info',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function totalCount(): int
    {
        return static::query()->count();
    }

    public static function countForUser(int $userId): int
    {
        return static::query()->where('user_id', $userId)->count();
    }

    public static function forUser(int $userId): Collection
    {
        return static::query()->where('user_id', $userId)->orderBy('id')->get();
    }

    public static function findForUser(int $userId, string $pddUserId): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('pdd_user_id', $pddUserId)
            ->first();
    }
}
