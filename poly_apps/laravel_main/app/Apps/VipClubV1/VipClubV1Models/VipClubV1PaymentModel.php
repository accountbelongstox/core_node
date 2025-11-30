<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Models\User;

class VipClubV1PaymentModel extends Model
{
    protected $table;

    protected $fillable = [
        'user_id',
        'booking_id',
        'payment_type',
        'membership_tier',
        'amount',
        'currency',
        'payment_method',
        'payment_status',
        'transaction_id',
        'payment_intent_id',
        'client_secret',
        'receipt_url',
        'payment_details',
        'paid_at'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_details' => 'array',
        'paid_at' => 'datetime'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('PAYMENTS');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(VipClubV1BookingModel::class, 'booking_id');
    }

    public function scopeByUser($query, int $userId)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id'), $userId);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status'), $status);
    }

    public function scopeByType($query, string $type)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_type'), $type);
    }

    public function scopeCompleted($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status'), 'completed');
    }

    public function scopePending($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status'), 'pending');
    }

    public function scopeRecent($query, int $days = 30)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('PAYMENTS', 'created_at'), '>=', now()->subDays($days));
    }
}
