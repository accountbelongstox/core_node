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

use App\Models\Model;
use Illuminate\Support\Collection;
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * A recharge / payment record (alipay|wechat). status pending|paid|failed|refunded.
 */
class PddToolV1RechargeModel extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REFUNDED = 'refunded';

    protected $appKey = AppKeys::PDDTOOLV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = PddToolV1TableMaps::getTableName('RECHARGES');
    }

    protected $fillable = [
        'user_id',
        'username',
        'out_trade_no',
        'amount',
        'method',
        'status',
        'package_name',
        'period',
        'grant_days',
        'pay_url',
        'qr_code',
        'sandbox',
        'paid_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'amount' => 'float',
        'grant_days' => 'integer',
        'sandbox' => 'boolean',
        'paid_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function paidRevenue($now): array
    {
        return [
            'total' => (float) static::query()->where('status', self::STATUS_PAID)->sum('amount'),
            'last_30_days' => (float) static::query()
                ->where('status', self::STATUS_PAID)
                ->where('paid_at', '>=', $now->copy()->subDays(30))
                ->sum('amount'),
        ];
    }

    public static function recentForUser(int $userId, int $limit = 50): Collection
    {
        return static::query()->where('user_id', $userId)->orderByDesc('id')->limit($limit)->get();
    }

    public static function adminPage(string $status, int $page, int $perPage): array
    {
        $query = static::query();

        if ($status !== '') {
            $query->where('status', $status);
        }

        return [
            'total' => (clone $query)->count(),
            'rows' => $query->orderByDesc('id')->forPage($page, $perPage)->get(),
        ];
    }

    public static function findForUserTrade(int $userId, string $outTradeNo): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('out_trade_no', $outTradeNo)
            ->first();
    }

    public static function findByTradeNo(string $outTradeNo): ?self
    {
        return static::query()->where('out_trade_no', $outTradeNo)->first();
    }
}
