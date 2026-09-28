<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
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
        'idempotency_key',
        'admin_id',
        'admin_notes',
        'reviewed_at',
        'refunded_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'refunded_at' => 'datetime',
    ];

    public static function paidAmountForUser(int $userId, ?string $roleType = null): float
    {
        $query = static::query()->where('user_id', $userId)->where('status', CodeMartV1Constants::DEPOSIT_STATUS_PAID);

        if ($roleType !== null) {
            $query->where('role_type', $roleType);
        }

        return (float) $query->sum('amount');
    }

    /**
     * Deposit policy for one role. The architect requirement is cumulative
     * (developer deposit + architect additional), so developer-role payments
     * count toward it; every other role counts only its own paid deposits.
     */
    public static function policyForRole(int $userId, string $roleType): array
    {
        $required = (float) CodeMartV1Constants::getDepositAmount($roleType);
        $paidOwn = self::paidAmountForUser($userId, $roleType);
        $paid = $roleType === CodeMartV1Constants::ROLE_ARCHITECT
            ? $paidOwn + self::paidAmountForUser($userId, CodeMartV1Constants::ROLE_DEVELOPER)
            : $paidOwn;
        $remaining = max(0.0, $required - $paid);

        return [
            'role_type' => $roleType,
            'required_amount' => number_format($required, 2, '.', ''),
            'paid_amount' => number_format($paid, 2, '.', ''),
            'paid_for_role' => number_format($paidOwn, 2, '.', ''),
            'remaining_amount' => number_format($remaining, 2, '.', ''),
            'is_sufficient' => $remaining <= 0.0,
        ];
    }

    public static function findOwned(int $depositId, int $userId, ?string $status = null): ?self
    {
        $query = static::query()->whereKey($depositId)->where('user_id', $userId);

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->first();
    }

    public static function findByIdempotencyKey(int $userId, string $key): ?self
    {
        return static::query()->where('user_id', $userId)->where('idempotency_key', $key)->first();
    }

    public static function lockById(int $depositId): ?self
    {
        return static::query()->whereKey($depositId)->lockForUpdate()->first();
    }

    public static function historyForUser(int $userId): array
    {
        $deposits = static::query()->where('user_id', $userId)->orderByDesc('created_at')->get();

        return [
            'deposits' => $deposits,
            'total_deposited' => $deposits->where('status', CodeMartV1Constants::DEPOSIT_STATUS_PAID)->sum('amount'),
        ];
    }
}
