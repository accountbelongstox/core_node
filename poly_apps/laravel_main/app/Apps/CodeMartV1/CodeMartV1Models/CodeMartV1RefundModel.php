<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1RefundModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_refunds';

    protected $fillable = [
        'payment_id',
        'amount',
        'status',
        'reason',
        'notes',
        'requested_at',
        'processed_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'requested_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1PaymentModel::class, 'payment_id');
    }

    public function approve(): bool
    {
        if ($this->status !== 'pending') {
            return false;
        }

        $this->update(['status' => 'approved']);
        return true;
    }

    public function reject(): bool
    {
        if ($this->status !== 'pending') {
            return false;
        }

        $this->update(['status' => 'rejected']);
        return true;
    }

    public function complete(): bool
    {
        if ($this->status !== 'approved') {
            return false;
        }

        $this->update([
            'status' => 'completed',
            'processed_at' => now(),
        ]);

        $payerWallet = CodeMartV1WalletModel::where('user_id', $this->payment->payer_id)->first();
        if ($payerWallet) {
            $payerWallet->deposit($this->amount->toFloat(), "Refund for payment {$this->payment_id}");
        }

        return true;
    }
}
