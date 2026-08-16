<?php

namespace App\Models;

use App\Models\Concerns\UsesMainConnection;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

class InviteCode extends Model
{
    use UsesMainConnection;

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

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public static function publicCodes(int $limit): EloquentCollection
    {
        return self::query()
            ->where('is_active', true)
            ->where(function ($query): void {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->whereColumn('used_count', '<', 'max_uses')
            ->select(['id', 'code', 'type', 'max_uses', 'used_count', 'expires_at', 'is_active', 'created_at'])
            ->latest('created_at')
            ->limit($limit)
            ->get();
    }

    public static function findByCode(string $code): ?self
    {
        return self::query()->where('code', $code)->first();
    }

    public static function seedWhenEmpty(array $attributes): bool
    {
        if (self::query()->exists()) {
            return false;
        }

        self::query()->create($attributes);

        return true;
    }

    public static function codesByType(string $type): array
    {
        return self::query()->where('type', $type)->pluck('code', 'type')->all();
    }

    public static function initializationStats(): array
    {
        $statuses = self::query()
            ->selectRaw('is_active, COUNT(*) as aggregate')
            ->groupBy('is_active')
            ->pluck('aggregate', 'is_active');
        $byType = self::query()
            ->selectRaw('type, COUNT(*) as aggregate')
            ->groupBy('type')
            ->pluck('aggregate', 'type')
            ->all();
        $active = (int) ($statuses[1] ?? $statuses['1'] ?? 0);
        $inactive = (int) ($statuses[0] ?? $statuses['0'] ?? 0);

        return [
            'total' => $active + $inactive,
            'active' => $active,
            'inactive' => $inactive,
            'by_type' => $byType,
        ];
    }

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

    public function use(User $user, ?string $deviceId = null, ?string $ipAddress = null, ?string $userAgent = null): bool
    {
        if (!$this->canBeUsed()) {
            return false;
        }

        InviteCodeUsage::create([
            'invite_code_id' => $this->id,
            'user_id' => $user->id,
            'device_id' => $deviceId,
            'used_at' => now(),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
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
