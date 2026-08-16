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
