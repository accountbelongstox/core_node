<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1InvoiceModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_invoices';

    protected $fillable = [
        'payment_id',
        'invoice_number',
        'issued_by',
        'description',
        'line_items',
        'subtotal',
        'tax',
        'total',
        'issued_date',
        'due_date',
        'status',
        'metadata',
    ];

    protected $casts = [
        'line_items' => 'json',
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'issued_date' => 'date',
        'due_date' => 'date',
        'metadata' => 'json',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1PaymentModel::class, 'payment_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'issued_by');
    }

    public static function userPage(int $userId, ?string $status, int $page, int $pageSize): array
    {
        $query = static::query()
            ->with('payment:id,payer_id,payee_id,amount,currency,status,type,project_id')
            ->whereIn('payment_id', CodeMartV1PaymentModel::query()
                ->select('id')
                ->where('payer_id', $userId)
                ->orWhere('payee_id', $userId));

        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        return self::paginateQuery($query->orderByDesc('id'), 'invoices', $page, $pageSize);
    }

    public function markAsPaid(): void
    {
        $this->update(['status' => 'paid']);
    }

    public function markAsOverdue(): void
    {
        if ($this->status !== 'paid') {
            $this->update(['status' => 'overdue']);
        }
    }
}
