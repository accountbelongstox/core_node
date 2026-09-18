<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

class CodeMartV1NotificationModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::NOTIFICATIONS_TABLE;

    protected $fillable = [
        'user_id',
        'type',
        'title_key',
        'body_key',
        'params',
        'resource_type',
        'resource_id',
        'read_at',
    ];

    protected $casts = [
        'params' => 'json',
        'read_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'user_id');
    }

    public static function pageForUser(int $userId, int $page, int $pageSize): array
    {
        $query = static::query()->where('user_id', $userId);

        return [
            'total' => (clone $query)->count(),
            'notifications' => $query->latest('created_at')->forPage($page, $pageSize)->get(),
        ];
    }

    public static function unreadCountForUser(int $userId): int
    {
        return static::query()->where('user_id', $userId)->whereNull('read_at')->count();
    }

    public static function markReadForUser(int $userId, int $notificationId): bool
    {
        return static::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->whereKey($notificationId)
            ->update(['read_at' => now(), 'updated_at' => now()]) === 1;
    }

    public static function markAllReadForUser(int $userId): int
    {
        return static::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);
    }
}
