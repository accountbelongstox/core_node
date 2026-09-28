<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

/**
 * DingDuoDuoV1 (订多多) super code: an offline-verifiable VIP unlock code (see
 * DingDuoDuoV1SuperCodeService). `scope` optionally limits which member_ids /
 * pdd_user_ids the code may manage; max_binds 0 = unlimited.
 */
class DingDuoDuoV1SuperCodeModel extends DingDuoDuoV1Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_REVOKED = 'revoked';

    protected ?string $appTableMapKey = 'SUPER_CODES';

    protected $fillable = [
        'code',
        'label',
        'tier',
        'max_binds',
        'features',
        'scope',
        'expires_at',
        'status',
        'created_by',
    ];

    protected $casts = [
        'max_binds' => 'integer',
        'features' => 'array',
        'scope' => 'array',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function countActiveCodes(array $codes): int
    {
        return static::query()->whereIn('code', $codes)->where('status', self::STATUS_ACTIVE)->count();
    }

    /** Marks the given codes revoked (rows are kept). Returns the rows changed. */
    public static function revokeCodes(array $codes): int
    {
        return static::query()
            ->whereIn('code', array_values(array_unique($codes)))
            ->where('status', self::STATUS_ACTIVE)
            ->update(['status' => self::STATUS_REVOKED, 'updated_at' => now()]);
    }

    public static function findByCode(string $code): ?self
    {
        return static::query()->where('code', $code)->first();
    }
}
