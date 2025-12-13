<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InviteCode extends Model
{
    protected $fillable = [
        'code',
        'type',
        'max_uses',
        'used_count',
        'expires_at',
        'is_active',
        'created_by',
        'description',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function usages(): HasMany
    {
        return $this->hasMany(InviteCodeUsage::class);
    }

    public function canBeUsed(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        if ($this->used_count >= $this->max_uses) {
            return false;
        }

        return true;
    }

    public function use(User $user): bool
    {
        if (!$this->canBeUsed()) {
            return false;
        }

        InviteCodeUsage::create([
            'invite_code_id' => $this->id,
            'user_id' => $user->id,
            'used_at' => now(),
        ]);

        $this->increment('used_count');

        if ($this->used_count >= $this->max_uses) {
            $this->update(['is_active' => false]);
        }

        return true;
    }

    public function getRoleLevel(): int
    {
        return match($this->type) {
            'super_admin' => 100,
            'admin' => 10,
            'moderator' => 5,
            default => 0,
        };
    }

    public function getRoleName(): string
    {
        return match($this->type) {
            'super_admin' => 'Super Administrator',
            'admin' => 'Administrator',
            'moderator' => 'Moderator',
            default => 'User',
        };
    }
}
