<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

use Illuminate\Support\Collection;

/**
 * A member's shipping warehouse / receiver address.
 */
class PddToolV1WarehouseModel extends PddToolV1Model
{
    protected ?string $appTableMapKey = 'WAREHOUSES';

    protected $fillable = [
        'user_id',
        'warehouse_code',
        'warehouse_name',
        'receiver_name',
        'phone',
        'province',
        'city',
        'district',
        'detail_address',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function forUser(int $userId): Collection
    {
        return static::query()->where('user_id', $userId)->orderBy('id')->get();
    }

    public static function findForUser(int $userId, string $warehouseCode): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('warehouse_code', $warehouseCode)
            ->first();
    }

    public static function deleteForUser(int $userId, string $warehouseCode): int
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('warehouse_code', $warehouseCode)
            ->delete();
    }
}
