<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * Live viewer presence (Social Center expansion §LIVE heartbeat). One row per
 * (session_id, user_id); last_seen_at bumped by the viewer heartbeat.
 * viewer_count is derived from rows fresh within STALE_SECONDS (mirrors the
 * user_presence 60s rule). No timestamps managed by Eloquent (last_seen_at set
 * explicitly).
 */
class AppQyV1LiveViewerModel extends AppQyV1Model
{
    /** A viewer row older than this many seconds is no longer counted. */
    public const STALE_SECONDS = 60;

    public $timestamps = false;


    protected ?string $appTableMapKey = 'LIVE_VIEWERS';

    protected $fillable = [
        'session_id',
        'user_id',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'session_id' => 'integer',
            'user_id' => 'integer',
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * Upsert a viewer heartbeat for ($sessionId, $userId), bumping last_seen_at.
     */
    public static function touch(int $sessionId, int $userId): void
    {
        static::query()->updateOrCreate(
            ['session_id' => $sessionId, 'user_id' => $userId],
            ['last_seen_at' => now()]
        );
    }

    /** Count of viewers with a fresh heartbeat for the given session. */
    public static function freshViewerCount(int $sessionId): int
    {
        return (int) static::query()
            ->where('session_id', $sessionId)
            ->where('last_seen_at', '>', now()->subSeconds(self::STALE_SECONDS))
            ->count();
    }

    /**
     * User ids of viewers with a fresh heartbeat for the given session.
     *
     * @return array<int, int>
     */
    public static function freshViewerIds(int $sessionId): array
    {
        return static::query()
            ->where('session_id', $sessionId)
            ->where('last_seen_at', '>', now()->subSeconds(self::STALE_SECONDS))
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
