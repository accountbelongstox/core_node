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

    public static function findActiveCode(string $code): ?self
    {
        return static::query()
            ->whereRaw('UPPER(code) = ?', [strtoupper($code)])
            ->where('status', self::STATUS_ACTIVE)
            ->first();
    }

    public static function countMatchingCodes(array $codes): int
    {
        return static::query()->whereIn('code', $codes)->count();
    }

    public static function findByCode(string $code): ?self
    {
        return static::query()->where('code', $code)->first();
    }

    public static function insertMasterCodes(array $codes, array $attributes): int
    {
        $rows = [];
        $timestamp = now();

        foreach (array_values(array_unique($codes)) as $code) {
            $rows[] = array_merge($attributes, [
                'code' => $code,
                'features' => json_encode($attributes['features'] ?? []),
                'scope' => isset($attributes['scope']) ? json_encode($attributes['scope']) : null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);
        }

        return $rows === [] ? 0 : static::query()->insertOrIgnore($rows);
    }
}
