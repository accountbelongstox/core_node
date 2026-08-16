<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Utils\RunsModelTransactions;

class CodeMartV1DepositModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = 'codemart_v1_deposits';

    protected $fillable = [
        'user_id',
        'role_type',
        'amount',
        'payment_method',
        'status',
        'payment_url',
        'paid_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public static function paidAmountForUser(int $userId, ?string $roleType = null): float
    {
        $query = static::query()->where('user_id', $userId)->where('status', 'paid');

        if ($roleType !== null) {
            $query->where('role_type', $roleType);
        }

        return (float) $query->sum('amount');
    }

    public static function findOwned(int $depositId, int $userId, ?string $status = null): ?self
    {
        $query = static::query()->whereKey($depositId)->where('user_id', $userId);

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->first();
    }

    public static function historyForUser(int $userId): array
    {
        $deposits = static::query()->where('user_id', $userId)->orderByDesc('created_at')->get();

        return [
            'deposits' => $deposits,
            'total_deposited' => $deposits->where('status', 'paid')->sum('amount'),
        ];
    }
}
