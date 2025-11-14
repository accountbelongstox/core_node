<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Models\User;

class VipClubV1BookingModel extends Model
{
    protected $table;

    protected $fillable = [
        'user_id',
        'facility_id',
        'facility_type',
        'facility_name',
        'booking_date',
        'time_slot',
        'duration',
        'price',
        'discount',
        'final_price',
        'status',
        'extras'
    ];

    protected $casts = [
        'booking_date' => 'date',
        'price' => 'decimal:2',
        'discount' => 'decimal:2',
        'final_price' => 'decimal:2',
        'duration' => 'integer',
        'extras' => 'array'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('BOOKINGS');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function facility(): BelongsTo
    {
        return $this->belongsTo(VipClubV1FacilityModel::class, 'facility_id');
    }

    public function pointsTransactions(): HasMany
    {
        return $this->hasMany(VipClubV1PointsTransactionModel::class, 'related_booking_id');
    }

    public function scopeByUser($query, int $userId)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'user_id'), $userId);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'status'), $status);
    }

    public function scopeByFacilityType($query, string $type)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_type'), $type);
    }

    public function scopeUpcoming($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date'), '>=', now()->toDateString())
                    ->whereIn(VipClubV1TablesMap::getFieldName('BOOKINGS', 'status'), ['pending', 'confirmed']);
    }

    public function scopePast($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date'), '<', now()->toDateString());
    }
}
