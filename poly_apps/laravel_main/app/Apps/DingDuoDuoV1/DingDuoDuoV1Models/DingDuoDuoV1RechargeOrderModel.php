<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

/**
 * DingDuoDuoV1 (订多多) recharge order. Idempotency key = out_trade_no (unique);
 * on a paid callback the membership is extended via DingDuoDuoV1MemberService.
 */
class DingDuoDuoV1RechargeOrderModel extends DingDuoDuoV1Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REFUNDED = 'refunded';

    protected ?string $appTableMapKey = 'RECHARGE_ORDERS';

    protected $fillable = [
        'member_id',
        'package_id',
        'amount',
        'status',
        'out_trade_no',
        'paid_at',
        'raw',
    ];

    protected $casts = [
        'member_id' => 'integer',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'raw' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function findByTradeNo(string $outTradeNo): ?self
    {
        return static::query()->where('out_trade_no', $outTradeNo)->first();
    }
}
