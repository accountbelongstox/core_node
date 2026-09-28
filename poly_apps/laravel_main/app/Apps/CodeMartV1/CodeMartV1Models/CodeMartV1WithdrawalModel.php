<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Developer payout request: pending -> approved -> paid, pending/approved -> rejected.
 * Requested funds stay frozen in the wallet until paid (settled) or rejected (unfrozen).
 */
class CodeMartV1WithdrawalModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = CodeMartV1TablesMaps::CODEMART_WITHDRAWALS_TABLE;

    protected $fillable = [
        'user_id',
        'amount',
        'currency',
        'status',
        'method',
        'account_info',
        'admin_id',
        'admin_notes',
        'idempotency_key',
        'reviewed_at',
        'paid_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'account_info' => 'json',
        'reviewed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public static function findByIdempotencyKey(int $userId, string $key): ?self
    {
        return static::query()->where('user_id', $userId)->where('idempotency_key', $key)->first();
    }

    public static function lockById(int $withdrawalId): ?self
    {
        return static::query()->whereKey($withdrawalId)->lockForUpdate()->first();
    }

    public static function userPage(int $userId, ?string $status, int $page, int $pageSize): array
    {
        $query = static::query()->where('user_id', $userId);
        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        return self::paginateQuery($query->orderByDesc('id'), 'withdrawals', $page, $pageSize);
    }

    public static function adminPage(?string $status, int $page, int $pageSize): array
    {
        $query = static::query()->with('user:id,username,name');
        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        return self::paginateQuery($query->orderByDesc('id'), 'withdrawals', $page, $pageSize);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [
            CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING,
            CodeMartV1Constants::WITHDRAWAL_STATUS_APPROVED,
        ], true);
    }
}
