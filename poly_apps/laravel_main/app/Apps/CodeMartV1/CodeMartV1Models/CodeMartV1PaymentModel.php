<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodeMartV1PaymentModel extends Model
{
    protected $connection = 'codemartv1';
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
}
