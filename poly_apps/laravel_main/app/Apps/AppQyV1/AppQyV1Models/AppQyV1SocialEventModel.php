<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Services\Realtime\OutboxCommitDispatcher;
use Illuminate\Support\Facades\Log;

/**
 * Per-user realtime event outbox for the social subsystem.
 * The Mercure hub delivers the live private-topic frame while this table
 * provides cursor recovery after disconnects. `data` holds the JSON-encoded
 * payload.
 */
class AppQyV1SocialEventModel extends AppQyV1Model
{
    private const TOPIC_PREFIX = 'wordnew.social.';
    private const EVENT_NAMES = [
        'message.new',
        'friend.request',
        'friend.accept',
        'friend.online',
        'friend.offline',
        'notification.new',
        'presence.update',
        'post.created',
        'post.liked',
        'post.comment',
        'live.started',
        'live.chat.new',
    ];


    // created_at only (append-only log); no updated_at column.
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'event',
        'data',
        'created_at',
        'published_at',
        'publish_after',
        'publish_attempts',
        'last_publish_error',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'created_at' => 'datetime',
            'published_at' => 'datetime',
            'publish_after' => 'datetime',
            'publish_attempts' => 'integer',
        ];
    }

    protected ?string $appTableMapKey = 'SOCIAL_EVENTS';

    /**
     * Persist one committed recipient event for bounded cursor recovery and
     * asynchronous Mercure publication.
     */
    public static function emit(int $userId, string $event, array $data): void
    {
        $connectionName = (new static())->getConnectionName();

        OutboxCommitDispatcher::dispatch(static function () use ($userId, $event, $data): void {
            try {
                static::query()->create([
                    'user_id' => $userId,
                    'event' => $event,
                    'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
                    'created_at' => now(),
                    'publish_attempts' => 0,
                ]);
            } catch (\Throwable $exception) {
                Log::warning('[AppQyV1SocialEvent] outbox append failed', [
                    'user_id' => $userId,
                    'event' => $event,
                    'error' => $exception->getMessage(),
                ]);
            }

            // Direct-emit (docs_fix/DESIGN_QUEUE_PIPELINE.md):
            // publish in the same request; the outbox row stays the durable
            // journal for failures (retried by the next emit).
            try {
                app(\App\Services\Realtime\RealtimeOutboxPublisher::class)->publishPending();
            } catch (\Throwable $publishException) {
                Log::warning('[AppQyV1SocialEvent] direct publish failed', [
                    'user_id' => $userId,
                    'event' => $event,
                    'error' => $publishException->getMessage(),
                ]);
            }
        }, $connectionName);
    }

    public static function pendingForPublish(int $limit)
    {
        return static::query()
            ->whereNull('published_at')
            ->where(static function ($query): void {
                $query->whereNull('publish_after')->orWhere('publish_after', '<=', now());
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public function payload(): array
    {
        $payload = json_decode((string) $this->data, true);

        return is_array($payload) ? $payload : [];
    }

    public function markPublished(): void
    {
        $this->forceFill([
            'published_at' => now(),
            'publish_after' => null,
            'last_publish_error' => null,
        ])->save();
    }

    public function markPublishFailed(string $error): void
    {
        $attempts = (int) $this->publish_attempts + 1;
        $retrySeconds = min(60, 2 ** min($attempts, 6));

        $this->forceFill([
            'publish_after' => now()->addSeconds($retrySeconds),
            'publish_attempts' => $attempts,
            'last_publish_error' => mb_substr($error, 0, 2000),
        ])->save();
    }

    public static function topic(int $userId): string
    {
        return self::TOPIC_PREFIX.$userId;
    }

    public static function eventNames(): array
    {
        return self::EVENT_NAMES;
    }

    /**
     * Fetch up to $limit events for $userId with id > $cursor, oldest first.
     * Each item is ['id' => int, 'event' => string, 'data' => array].
     *
     * @return array<int, array{id:int, event:string, data:array}>
     */
    public static function since(int $userId, int $cursor, int $limit = 200): array
    {
        $rows = static::query()
            ->where('user_id', $userId)
            ->where('id', '>', $cursor)
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get(['id', 'event', 'data']);

        $out = [];
        foreach ($rows as $row) {
            $decoded = json_decode((string) $row->data, true);
            if (!is_array($decoded)) {
                $decoded = [];
            }
            $out[] = [
                'id' => (int) $row->id,
                'event' => (string) $row->event,
                'data' => $decoded,
            ];
        }
        return $out;
    }

    /** Highest event id for $userId (0 when none). A fresh client starts here. */
    public static function maxId(int $userId): int
    {
        return (int) static::query()->where('user_id', $userId)->max('id');
    }

    /**
     * Delete events older than $seconds across all users. Best-effort; returns
     * the deleted row count. Emit scheduling keeps this operation bounded.
     */
    public static function pruneOlderThan(int $seconds = 600): int
    {
        try {
            return (int) static::query()
                ->whereNotNull('published_at')
                ->where('published_at', '<', now()->subSeconds($seconds))
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1SocialEvent] outbox prune failed', [
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }

}
