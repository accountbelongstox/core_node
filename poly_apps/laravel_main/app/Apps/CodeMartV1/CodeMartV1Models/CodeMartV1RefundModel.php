<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Models\Model;
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

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

    public static function findById(int $refundId): ?self
    {
        return static::query()->find($refundId);
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

        $payerWallet = CodeMartV1WalletModel::forUser((int) $this->payment->payer_id);
        if ($payerWallet) {
            $payerWallet->deposit($this->amount->toFloat(), "Refund for payment {$this->payment_id}");
        }

        return true;
    }
}
