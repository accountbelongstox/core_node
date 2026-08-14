<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1UserRoleModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_user_roles';

    protected $fillable = [
        'user_id',
        'role_type',
        'role_status',
        'deposit_amount',
        'role_activated_at',
    ];

    protected $casts = [
        'role_activated_at' => 'datetime',
        'deposit_amount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public function isActive(): bool
    {
        return $this->role_status === 'active';
    }

    public function isPending(): bool
    {
        return $this->role_status === 'pending';
    }

    public function isSuspended(): bool
    {
        return $this->role_status === 'suspended';
    }

    public static function forUser(int $userId): ?self
    {
        return static::query()->where('user_id', $userId)->first();
    }

    public static function forUserAndType(int $userId, string $roleType, ?string $status = null): ?self
    {
        $query = static::query()->where('user_id', $userId)->where('role_type', $roleType);

        if ($status !== null) {
            $query->where('role_status', $status);
        }

        return $query->first();
    }

    public static function forUserAndStatus(int $userId, string $status): ?self
    {
        return static::query()->where('user_id', $userId)->where('role_status', $status)->first();
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }
}
