<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodeMartV1PaymentModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = 'codemart_v1_payments';

    protected $fillable = [
        'payer_id',
        'payee_id',
        'project_id',
        'milestone_id',
        'amount',
        'currency',
        'type',
        'status',
        'payment_method',
        'transaction_id',
        'description',
        'metadata',
        'idempotency_key',
        'business_ref',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'metadata' => 'json',
    ];

    public function payer(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'payer_id');
    }

    public function payee(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'payee_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1MilestoneModel::class, 'milestone_id');
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(CodeMartV1InvoiceModel::class, 'payment_id');
    }

    public function refund(): HasOne
    {
        return $this->hasOne(CodeMartV1RefundModel::class, 'payment_id');
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isParticipant(int $userId): bool
    {
        return (int) $this->payer_id === $userId || (int) $this->payee_id === $userId;
    }

    public static function findByIdempotencyKey(int $payerId, string $key): ?self
    {
        return static::query()->where('payer_id', $payerId)->where('idempotency_key', $key)->first();
    }

    public static function findByBusinessRef(string $businessRef): ?self
    {
        return static::query()->where('business_ref', $businessRef)->first();
    }

    public static function lockById(int $paymentId): ?self
    {
        return static::query()->whereKey($paymentId)->lockForUpdate()->first();
    }

    public static function adminPage(?string $status, ?string $type, int $page, int $pageSize): array
    {
        $query = static::query()->with(['payer:id,username,name', 'payee:id,username,name']);
        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }
        if ($type !== null && $type !== '') {
            $query->where('type', $type);
        }

        return self::paginateQuery($query->orderByDesc('id'), 'payments', $page, $pageSize);
    }

    public static function findDetailed(int $paymentId): ?self
    {
        return static::query()->with(['payer', 'payee', 'invoice', 'refund'])->find($paymentId);
    }

    public static function userPage(
        int $userId,
        ?string $status,
        ?string $type,
        int $page,
        int $pageSize
    ): array {
        $query = static::query()->where(function ($builder) use ($userId): void {
            $builder->where('payer_id', $userId)->orWhere('payee_id', $userId);
        });

        if ($status !== null) {
            $query->where('status', $status);
        }
        if ($type !== null) {
            $query->where('type', $type);
        }

        return self::paginateQuery(
            $query->orderByDesc('created_at'),
            'payments',
            $page,
            $pageSize
        );
    }
}
