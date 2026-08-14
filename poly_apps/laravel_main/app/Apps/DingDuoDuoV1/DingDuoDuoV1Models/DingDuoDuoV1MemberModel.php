<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1DBTablesBrige\DingDuoDuoV1TableMaps;

/**
 * DingDuoDuoV1 (订多多) member: identity + membership for the extension's
 * no-super-code path. `token` is the bearer the extension presents (header
 * X-DD-Token); `password` is bcrypt-hashed and never serialized.
 */
class DingDuoDuoV1MemberModel extends Model
{
    protected $appKey = AppKeys::DINGDUODUOV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = DingDuoDuoV1TableMaps::getTableName('MEMBERS');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'username',
        'password',
        'token',
        'tier',
        'max_binds',
        'balance',
        'permissions',
        'expires_at',
        'status',
        'remark',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'max_binds' => 'integer',
        'balance' => 'decimal:2',
        'permissions' => 'array',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function adminPage(string $search, string $tier, int $perPage)
    {
        $query = static::query()->orderByDesc('id');

        if ($search !== '') {
            $query->where('username', 'like', '%' . $search . '%');
        }
        if ($tier !== '') {
            $query->where('tier', $tier);
        }

        return $query->paginate($perPage);
    }

    public static function findById(int $memberId): ?self
    {
        return static::query()->find($memberId);
    }

    public static function findByUsername(string $username): ?self
    {
        return static::query()->where('username', $username)->first();
    }

    public static function usernameExists(string $username): bool
    {
        return static::query()->where('username', $username)->exists();
    }

    public static function tokenExists(string $token): bool
    {
        return static::query()->where('token', $token)->exists();
    }

    public static function activeByToken(string $token): ?self
    {
        return static::query()->where('token', $token)->where('status', 'active')->first();
    }

    public static function byToken(string $token): ?self
    {
        return static::query()->where('token', $token)->first();
    }
}
