<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Models\User;

class VipClubV1PointsTransactionModel extends Model
{
    protected $table;

    protected $fillable = [
        'user_id',
        'points',
        'type',
        'description',
        'related_booking_id'
    ];

    protected $casts = [
        'points' => 'integer'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('POINTS_TRANSACTIONS');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(VipClubV1BookingModel::class, 'related_booking_id');
    }

    public function scopeByUser($query, int $userId)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'user_id'), $userId);
    }

    public function scopeByType($query, string $type)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'type'), $type);
    }

    public function scopeEarnings($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'type'), 'earn');
    }

    public function scopeRedemptions($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'type'), 'redeem');
    }

    public function scopeRecent($query, int $days = 30)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'created_at'), '>=', now()->subDays($days));
    }
}
