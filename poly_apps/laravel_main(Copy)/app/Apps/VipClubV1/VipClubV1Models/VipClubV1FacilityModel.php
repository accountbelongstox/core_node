<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;

class VipClubV1FacilityModel extends Model
{
    protected $table;

    protected $fillable = [
        'name',
        'type',
        'description',
        'image_url',
        'base_price',
        'available_times',
        'features',
        'is_active',
        'vip_only',
        'specific_data'
    ];

    protected $casts = [
        'available_times' => 'array',
        'features' => 'array',
        'specific_data' => 'array',
        'is_active' => 'boolean',
        'vip_only' => 'boolean',
        'base_price' => 'decimal:2'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('FACILITIES');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(VipClubV1BookingModel::class, 'facility_id');
    }

    public function scopeActive($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('FACILITIES', 'is_active'), true);
    }

    public function scopeByType($query, string $type)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('FACILITIES', 'type'), $type);
    }

    public function scopeVipOnly($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('FACILITIES', 'vip_only'), true);
    }

    public function scopePublic($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('FACILITIES', 'vip_only'), false);
    }
}
