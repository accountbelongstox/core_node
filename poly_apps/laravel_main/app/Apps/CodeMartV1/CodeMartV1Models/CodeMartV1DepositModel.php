<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Utils\RunsModelTransactions;
use App\Models\Model;

class CodeMartV1DepositModel extends Model
{
    use RunsModelTransactions;

    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_deposits';

    protected $fillable = [
        'user_id',
        'role_type',
        'amount',
        'payment_method',
        'status',
        'payment_url',
        'paid_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public static function paidAmountForUser(int $userId, ?string $roleType = null): float
    {
        $query = static::query()->where('user_id', $userId)->where('status', 'paid');

        if ($roleType !== null) {
            $query->where('role_type', $roleType);
        }

        return (float) $query->sum('amount');
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

    public static function findOwned(int $depositId, int $userId, ?string $status = null): ?self
    {
        $query = static::query()->whereKey($depositId)->where('user_id', $userId);

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->first();
    }

    public static function historyForUser(int $userId): array
    {
        $deposits = static::query()->where('user_id', $userId)->orderByDesc('created_at')->get();

        return [
            'deposits' => $deposits,
            'total_deposited' => $deposits->where('status', 'paid')->sum('amount'),
        ];
    }
}
