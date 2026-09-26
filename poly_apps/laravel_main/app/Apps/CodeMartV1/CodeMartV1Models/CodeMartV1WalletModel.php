<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Wallet balances change only through the ledger methods below, which must be
 * called on a row obtained from lockForUser() inside a DB transaction. Every
 * movement appends an immutable wallet transaction row.
 */
class CodeMartV1WalletModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    private const SCALE = 2;

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

    public static function forUser(int $userId, bool $create = false): ?self
    {
        if (!$create) {
            return static::query()->where('user_id', $userId)->first();
        }

        return static::query()->firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0, 'available_balance' => 0, 'frozen_balance' => 0]
        );
    }

    /**
     * Returns the user's wallet row locked FOR UPDATE, creating it without a
     * unique-violation race when missing. Call inside a transaction.
     */
    public static function lockForUser(int $userId): self
    {
        if (!static::query()->where('user_id', $userId)->exists()) {
            static::query()->insertOrIgnore([
                'user_id' => $userId,
                'balance' => 0,
                'available_balance' => 0,
                'frozen_balance' => 0,
                'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return static::query()->where('user_id', $userId)->lockForUpdate()->firstOrFail();
    }

    /**
     * Locks several users' wallets in ascending user id order (deadlock-safe).
     *
     * @return array<int, self> keyed by user id
     */
    public static function lockForUsers(array $userIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $userIds)));
        sort($ids);
        $wallets = [];
        foreach ($ids as $userId) {
            $wallets[$userId] = static::lockForUser($userId);
        }

        return $wallets;
    }

    public function transactionPage(int $page, int $pageSize): array
    {
        $query = $this->transactions();
        return self::paginateQuery(
            $query->orderByDesc('created_at')->orderByDesc('id'),
            'transactions',
            $page,
            $pageSize
        );
    }

    public function hasAvailable(string $amount): bool
    {
        return bccomp((string) $this->available_balance, $amount, self::SCALE) >= 0;
    }

    public function credit(string $amount, string $type, string $description = '', array $metadata = []): CodeMartV1WalletTransactionModel
    {
        $this->balance = bcadd((string) $this->balance, $amount, self::SCALE);
        $this->available_balance = bcadd((string) $this->available_balance, $amount, self::SCALE);
        $this->save();

        return $this->appendLedger($type, $amount, $description, $metadata + ['direction' => 'in']);
    }

    public function debit(string $amount, string $type, string $description = '', array $metadata = []): ?CodeMartV1WalletTransactionModel
    {
        if (!$this->hasAvailable($amount)) {
            return null;
        }

        $this->balance = bcsub((string) $this->balance, $amount, self::SCALE);
        $this->available_balance = bcsub((string) $this->available_balance, $amount, self::SCALE);
        $this->save();

        return $this->appendLedger($type, $amount, $description, $metadata + ['direction' => 'out']);
    }

    public function freeze(string $amount, string $type, string $description = '', array $metadata = []): ?CodeMartV1WalletTransactionModel
    {
        if (!$this->hasAvailable($amount)) {
            return null;
        }

        $this->available_balance = bcsub((string) $this->available_balance, $amount, self::SCALE);
        $this->frozen_balance = bcadd((string) $this->frozen_balance, $amount, self::SCALE);
        $this->save();

        return $this->appendLedger(
            $type,
            $amount,
            $description,
            $metadata + ['direction' => 'freeze'],
            CodeMartV1Constants::WALLET_TX_STATUS_PENDING
        );
    }

    public function unfreeze(string $amount, string $type, string $description = '', array $metadata = []): ?CodeMartV1WalletTransactionModel
    {
        if (bccomp((string) $this->frozen_balance, $amount, self::SCALE) < 0) {
            return null;
        }

        $this->frozen_balance = bcsub((string) $this->frozen_balance, $amount, self::SCALE);
        $this->available_balance = bcadd((string) $this->available_balance, $amount, self::SCALE);
        $this->save();

        return $this->appendLedger(
            $type,
            $amount,
            $description,
            $metadata + ['direction' => 'unfreeze'],
            CodeMartV1Constants::WALLET_TX_STATUS_CANCELLED
        );
    }

    public function settleFrozen(string $amount, string $type, string $description = '', array $metadata = []): ?CodeMartV1WalletTransactionModel
    {
        if (bccomp((string) $this->frozen_balance, $amount, self::SCALE) < 0) {
            return null;
        }

        $this->frozen_balance = bcsub((string) $this->frozen_balance, $amount, self::SCALE);
        $this->balance = bcsub((string) $this->balance, $amount, self::SCALE);
        $this->save();

        return $this->appendLedger($type, $amount, $description, $metadata + ['direction' => 'out']);
    }

    private function appendLedger(
        string $type,
        string $amount,
        string $description,
        array $metadata,
        string $status = CodeMartV1Constants::WALLET_TX_STATUS_SUCCESS
    ): CodeMartV1WalletTransactionModel {
        return CodeMartV1WalletTransactionModel::create([
            'wallet_id' => $this->id,
            'type' => $type,
            'amount' => $amount,
            'balance_after' => (string) $this->balance,
            'description' => $description,
            'metadata' => $metadata,
            'status' => $status,
        ]);
    }
}
