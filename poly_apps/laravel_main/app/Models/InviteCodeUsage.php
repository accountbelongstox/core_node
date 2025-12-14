<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InviteCodeUsage extends Model
{
    protected $table = 'invite_code_usage';

    protected $fillable = [
        'invite_code_id',
        'user_id',
        'device_id',
        'used_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'used_at' => 'datetime',
    ];

    public function inviteCode(): BelongsTo
    {
        return $this->belongsTo(InviteCode::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
