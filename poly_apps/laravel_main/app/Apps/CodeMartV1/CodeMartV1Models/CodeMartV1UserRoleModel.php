<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
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
}
