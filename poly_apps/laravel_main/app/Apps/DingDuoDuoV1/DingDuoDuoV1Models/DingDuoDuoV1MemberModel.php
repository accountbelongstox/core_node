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

/**
 * DingDuoDuoV1 (订多多) member: app-specific membership extension row linked to
 * the canonical global users table via `user_id` (shared account/password live
 * on users; auth issues Sanctum tokens). The legacy `username`/`password`/`token`
 * columns are retained for pre-linkage rows only and are no longer written or
 * read by the auth path; `password` is never serialized.
 */
class DingDuoDuoV1MemberModel extends DingDuoDuoV1Model
{
    protected ?string $appTableMapKey = 'MEMBERS';

    protected $fillable = [
        'user_id',
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
        'user_id' => 'integer',
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

    public static function findByUsername(string $username): ?self
    {
        return static::query()->where('username', $username)->first();
    }

    public static function findByUserId(int $userId): ?self
    {
        return static::query()->where('user_id', $userId)->first();
    }

    public static function usernameExists(string $username): bool
    {
        return static::query()->where('username', $username)->exists();
    }
}
