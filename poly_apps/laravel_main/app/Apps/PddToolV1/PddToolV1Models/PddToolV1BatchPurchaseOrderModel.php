<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

use Illuminate\Support\Collection;

/**
 * One purchase-order line within a batch.
 */
class PddToolV1BatchPurchaseOrderModel extends PddToolV1Model
{
    protected ?string $appTableMapKey = 'BATCH_PURCHASE_ORDERS';

    protected $fillable = [
        'batch_id',
        'user_id',
        'purchase_order_no',
        'goods_id',
        'sku_id',
        'quantity',
        'status',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'quantity' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function forUserBatch(int $userId, string $batchId): Collection
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('batch_id', $batchId)
            ->orderBy('id')
            ->get();
    }
}
