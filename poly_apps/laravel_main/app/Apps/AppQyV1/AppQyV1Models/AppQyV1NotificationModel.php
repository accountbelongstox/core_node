<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Per-user notification inbox (SOCIAL_FEATURE_SPECIFICATION.md §1/§2).
 * read_at null = unread. created_at only (no updated_at).
 */
class AppQyV1NotificationModel extends AppQyV1Model
{
    // created_at only; read_at flips on read. No updated_at column.
    public $timestamps = false;


    protected ?string $appTableMapKey = 'NOTIFICATIONS';

    protected $fillable = [
        'user_id',
        'type',
        'payload',
        'read_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'payload' => 'array',
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public static function inboxForUser(int $userId, int $cursor, bool $unreadOnly, int $limit): Collection
    {
        $query = null;

        $query = static::query()
            ->where('user_id', $userId)
            ->orderByDesc('id');

        if ($cursor > 0) {
            $query->where('id', '<', $cursor);
        }
        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        return $query->limit($limit)->get();
    }

    public static function unreadCountForUser(int $userId): int
    {
        return (int) static::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->count();
    }

    public static function markReadForUser(int $userId, ?int $notificationId = null): int
    {
        $query = null;

        $query = static::query()
            ->where('user_id', $userId)
            ->whereNull('read_at');

        if ($notificationId !== null) {
            $query->where('id', $notificationId);
        }

        return (int) $query->update(['read_at' => now()]);
    }

    /**
     * Create a notification for a recipient. Best-effort: a failure is logged and
     * swallowed so it never breaks the triggering action. Returns the row id or 0.
     */
    public static function notify(int $userId, string $type, array $payload = []): int
    {
        try {
            $row = static::query()->create([
                'user_id' => $userId,
                'type' => $type,
                'payload' => $payload,
                'read_at' => null,
                'created_at' => now(),
            ]);
            return (int) $row->id;
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1Notification] create failed', [
                'user_id' => $userId,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }
}
