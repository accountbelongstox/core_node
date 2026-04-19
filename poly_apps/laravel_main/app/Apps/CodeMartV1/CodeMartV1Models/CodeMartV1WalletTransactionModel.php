<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1WalletTransactionModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_wallet_transactions';

    protected $fillable = [
        'wallet_id',
        'type',
        'amount',
        'balance_after',
        'description',
        'metadata',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'metadata' => 'json',
    ];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1WalletModel::class, 'wallet_id');
    }
}
