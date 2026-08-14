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

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1DBTablesBrige\DingDuoDuoV1TableMaps;

/**
 * DingDuoDuoV1 (订多多) recharge order. Idempotency key = out_trade_no (unique);
 * on a paid callback the membership is extended via DingDuoDuoV1MemberService.
 */
class DingDuoDuoV1RechargeOrderModel extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REFUNDED = 'refunded';

    protected $appKey = AppKeys::DINGDUODUOV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = DingDuoDuoV1TableMaps::getTableName('RECHARGE_ORDERS');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

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

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

    public static function findByTradeNo(string $outTradeNo): ?self
    {
        return static::query()->where('out_trade_no', $outTradeNo)->first();
    }
}
