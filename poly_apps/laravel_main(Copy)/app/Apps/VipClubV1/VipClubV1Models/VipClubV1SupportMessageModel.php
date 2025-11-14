<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Models\User;

class VipClubV1SupportMessageModel extends Model
{
    protected $table;

    protected $fillable = [
        'user_id',
        'message',
        'attachments',
        'is_from_user',
        'is_read'
    ];

    protected $casts = [
        'attachments' => 'array',
        'is_from_user' => 'boolean',
        'is_read' => 'boolean'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('SUPPORT_MESSAGES');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function scopeByUser($query, int $userId)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'user_id'), $userId);
    }

    public function scopeUnread($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_read'), false);
    }

    public function scopeFromUser($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_from_user'), true);
    }

    public function scopeFromSupport($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_from_user'), false);
    }

    public function markAsRead()
    {
        $this->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_read')} = true;
        $this->save();
    }
}
