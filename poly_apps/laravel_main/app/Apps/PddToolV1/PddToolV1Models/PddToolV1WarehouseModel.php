<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

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
