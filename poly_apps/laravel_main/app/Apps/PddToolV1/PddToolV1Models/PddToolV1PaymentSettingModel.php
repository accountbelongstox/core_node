<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

/**
 * Single-row gateway config (enable toggles + non-secret identifiers). The real
 * merchant secrets (private keys / api_v3_key) live in RuntimeConfigurationStore, NOT here.
 */
class PddToolV1PaymentSettingModel extends PddToolV1Model
{
    protected ?string $appTableMapKey = 'PAYMENT_SETTINGS';

    protected $fillable = [
        'alipay_enabled',
        'alipay_app_id',
        'wechat_enabled',
        'wechat_mch_id',
        'wechat_app_id',
    ];

    protected $casts = [
        'alipay_enabled' => 'boolean',
        'wechat_enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function current(): ?self
    {
        return static::query()->first();
    }

    public static function currentOrNew(): self
    {
        return static::current() ?? new static();
    }
}
