<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodeMartV1WalletModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_wallets';

    protected $fillable = [
        'user_id',
        'balance',
        'available_balance',
        'frozen_balance',
        'currency',
    ];

    protected $casts = [
        'balance' => 'decimal:2',
        'available_balance' => 'decimal:2',
        'frozen_balance' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CodeMartV1WalletTransactionModel::class, 'wallet_id');
    }

    public function deposit(float $amount, string $description = '', array $metadata = []): CodeMartV1WalletTransactionModel
    {
        $this->increment('balance', $amount);
        $this->increment('available_balance', $amount);

        return CodeMartV1WalletTransactionModel::create([
            'wallet_id' => $this->id,
            'type' => 'deposit',
            'amount' => $amount,
            'balance_after' => $this->balance,
            'description' => $description,
            'metadata' => $metadata,
            'status' => 'success',
        ]);
    }

    public function withdrawal(float $amount, string $description = '', array $metadata = []): ?CodeMartV1WalletTransactionModel
    {
        if ($this->available_balance < $amount) {
            return null;
        }

        $this->decrement('balance', $amount);
        $this->decrement('available_balance', $amount);

        return CodeMartV1WalletTransactionModel::create([
            'wallet_id' => $this->id,
            'type' => 'withdrawal',
            'amount' => $amount,
            'balance_after' => $this->balance,
            'description' => $description,
            'metadata' => $metadata,
            'status' => 'success',
        ]);
    }

    public function holdFunds(float $amount, string $description = ''): ?CodeMartV1WalletTransactionModel
    {
        if ($this->available_balance < $amount) {
            return null;
        }

        $this->decrement('available_balance', $amount);
        $this->increment('frozen_balance', $amount);

        return CodeMartV1WalletTransactionModel::create([
            'wallet_id' => $this->id,
            'type' => 'escrow_hold',
            'amount' => $amount,
            'balance_after' => $this->balance,
            'description' => $description,
            'status' => 'success',
        ]);
    }

    public function releaseFunds(float $amount, string $description = ''): bool
    {
        if ($this->frozen_balance < $amount) {
            return false;
        }

        $this->decrement('frozen_balance', $amount);
        $this->increment('available_balance', $amount);

        CodeMartV1WalletTransactionModel::create([
            'wallet_id' => $this->id,
            'type' => 'escrow_release',
            'amount' => $amount,
            'balance_after' => $this->balance,
            'description' => $description,
            'status' => 'success',
        ]);

        return true;
    }
}
