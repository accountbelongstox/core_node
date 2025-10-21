<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1EscrowModel extends Model
{
    protected $table = 'codemart_escrows';

    protected $fillable = [
        'project_id',
        'payer_id',
        'payee_id',
        'amount',
        'currency',
        'status',
        'released_at',
        'release_reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'released_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'payer_id');
    }

    public function payee(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'payee_id');
    }

    public function release(string $reason = ''): bool
    {
        if ($this->status !== 'held') {
            return false;
        }

        $this->update([
            'status' => 'released',
            'released_at' => now(),
            'release_reason' => $reason,
        ]);

        $payeeWallet = CodeMartV1WalletModel::where('user_id', $this->payee_id)->first();
        if ($payeeWallet) {
            $payeeWallet->releaseFunds($this->amount->toFloat(), "Escrow released for project {$this->project_id}");
        }

        return true;
    }

    public function refund(string $reason = ''): bool
    {
        if ($this->status !== 'held') {
            return false;
        }

        $this->update([
            'status' => 'refunded',
        ]);

        $payerWallet = CodeMartV1WalletModel::where('user_id', $this->payer_id)->first();
        if ($payerWallet) {
            $payerWallet->releaseFunds($this->amount->toFloat(), "Escrow refunded: {$reason}");
        }

        return true;
    }
}
