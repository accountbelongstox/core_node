<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Models\User;

class VipClubV1VipCardModel extends Model
{
    protected $table;

    protected $fillable = [
        'card_number',
        'user_id',
        'member_type',
        'issue_date',
        'expiry_date',
        'points',
        'benefits',
        'qr_code',
        'is_active'
    ];

    protected $casts = [
        'issue_date' => 'datetime',
        'expiry_date' => 'datetime',
        'points' => 'integer',
        'benefits' => 'array',
        'is_active' => 'boolean'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('VIP_CARDS');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function scopeActive($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('VIP_CARDS', 'is_active'), true);
    }

    public function scopeByMemberType($query, string $memberType)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('VIP_CARDS', 'member_type'), $memberType);
    }

    public function scopeExpired($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('VIP_CARDS', 'expiry_date'), '<', now());
    }

    public function scopeValid($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('VIP_CARDS', 'is_active'), true)
                    ->where(VipClubV1TablesMap::getFieldName('VIP_CARDS', 'expiry_date'), '>=', now());
    }

    public function isExpired(): bool
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }

    public function isValid(): bool
    {
        return $this->is_active && !$this->isExpired();
    }
}
