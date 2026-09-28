<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

use Illuminate\Support\Collection;

/**
 * A PDD platform account bound by a member (cookie + access token + profile).
 */
class PddToolV1PddAccountModel extends PddToolV1Model
{
    protected ?string $appTableMapKey = 'PDD_ACCOUNTS';

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
