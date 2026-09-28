<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

/**
 * A batch-order submission (header). Child rows live in batch_purchase_orders.
 */
class PddToolV1BatchOrderModel extends PddToolV1Model
{
    protected ?string $appTableMapKey = 'BATCH_ORDERS';

    protected $fillable = [
        'user_id',
        'batch_id',
        'order_count',
        'status',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'order_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function countForUser(int $userId): int
    {
        return static::query()->where('user_id', $userId)->count();
    }
}
