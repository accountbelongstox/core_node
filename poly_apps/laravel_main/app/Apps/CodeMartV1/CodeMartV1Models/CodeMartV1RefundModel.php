<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Refund lifecycle: pending -> approved -> completed, pending/approved -> rejected.
 * Money movement happens only in CodeMartV1FinanceService::processRefund.
 */
class CodeMartV1RefundModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    public const OPEN_STATUSES = [
        CodeMartV1Constants::REFUND_STATUS_PENDING,
        CodeMartV1Constants::REFUND_STATUS_APPROVED,
    ];

    protected $table = 'codemart_v1_refunds';

    protected $fillable = [
        'payment_id',
        'amount',
        'status',
        'reason',
        'notes',
        'requested_at',
        'processed_at',
        'requested_by',
        'admin_id',
        'admin_notes',
        'reviewed_at',
        'idempotency_key',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'requested_at' => 'datetime',
        'processed_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1PaymentModel::class, 'payment_id');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    public static function openForPayment(int $paymentId): ?self
    {
        return static::query()
            ->where('payment_id', $paymentId)
            ->whereIn('status', self::OPEN_STATUSES)
            ->orderByDesc('id')
            ->first();
    }

    public static function lockById(int $refundId): ?self
    {
        return static::query()->whereKey($refundId)->lockForUpdate()->first();
    }

    public static function findByIdempotencyKey(int $userId, string $key): ?self
    {
        return static::query()->where('requested_by', $userId)->where('idempotency_key', $key)->first();
    }

    public static function userPage(int $userId, ?string $status, int $page, int $pageSize): array
    {
        $query = static::query()
            ->with('payment:id,payer_id,payee_id,amount,currency,status,type,project_id')
            ->where(function ($builder) use ($userId): void {
                $builder->where('requested_by', $userId)
                    ->orWhereIn('payment_id', CodeMartV1PaymentModel::query()
                        ->select('id')
                        ->where('payer_id', $userId)
                        ->orWhere('payee_id', $userId));
            });

        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        return self::paginateQuery($query->orderByDesc('id'), 'refunds', $page, $pageSize);
    }
}
