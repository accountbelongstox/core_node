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
