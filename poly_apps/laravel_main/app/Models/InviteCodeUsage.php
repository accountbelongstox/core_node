<?php

namespace App\Models;

use App\Models\Concerns\UsesMainConnection;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InviteCodeUsage extends Model
{
    use UsesMainConnection;

    protected $table = 'invite_code_usage';

    protected $fillable = [
        'invite_code_id',
        'user_id',
        'device_id',
        'used_at',
        'ip_address',
        'user_agent',
    ];

    public static function rowCount(): int
    {
        return self::query()->count();
    }

    protected function casts(): array
    {
        return [
            'used_at' => 'datetime',
        ];
    }

    public function inviteCode(): BelongsTo
    {
        return $this->belongsTo(InviteCode::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
