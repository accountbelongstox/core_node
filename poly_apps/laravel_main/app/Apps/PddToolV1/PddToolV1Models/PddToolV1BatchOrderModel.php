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
