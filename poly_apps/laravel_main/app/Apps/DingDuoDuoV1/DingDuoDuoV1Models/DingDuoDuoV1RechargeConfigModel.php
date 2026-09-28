<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

/**
 * DingDuoDuoV1 (订多多) recharge-API settings (single config row): provider
 * credentials, gateway endpoint / notify URL and the offered package list.
 */
class DingDuoDuoV1RechargeConfigModel extends DingDuoDuoV1Model
{
    protected ?string $appTableMapKey = 'RECHARGE_CONFIGS';

    protected $fillable = [
        'provider',
        'api_key',
        'api_secret',
        'endpoint',
        'notify_url',
        'packages',
        'enabled',
    ];

    protected $hidden = [
        'api_secret',
    ];

    protected $casts = [
        'packages' => 'array',
        'enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function enabled(): ?self
    {
        return static::query()->where('enabled', true)->first();
    }

    public static function current(): ?self
    {
        return static::query()->orderBy('id')->first();
    }

    public static function anyExists(): bool
    {
        return static::query()->exists();
    }
}
