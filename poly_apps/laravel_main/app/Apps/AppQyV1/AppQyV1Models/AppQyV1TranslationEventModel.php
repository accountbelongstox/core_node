<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\Realtime\OutboxCommitDispatcher;
use Illuminate\Support\Facades\Log;

/**
 * Persistent real-time event outbox shared by Queue Center publishers.
 * Relevant events broadcast through Reverb immediately; rows remain available
 * for bounded cursor replay after a client reconnects.
 */
class AppQyV1TranslationEventModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    // created_at only (append-only log); no updated_at column.
    public $timestamps = false;

    protected $fillable = [
        'event',
        'data',
        'created_at',
        'published_at',
        'publish_after',
        'publish_attempts',
        'last_publish_error',
    ];

    protected $casts = [
        'id' => 'integer',
        'created_at' => 'datetime',
        'published_at' => 'datetime',
        'publish_after' => 'datetime',
        'publish_attempts' => 'integer',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'translation_events');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * Append one committed event to the outbox. Reverb publication is owned by
     * RealtimeOutboxPublisher through the runtime's bounded publisher task.
     */
    public static function emit(string $event, array $data): void
    {
        OutboxCommitDispatcher::dispatch(static function () use ($event, $data): void {
            try {
                static::query()->create([
                    'event' => $event,
                    'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
                    'created_at' => now(),
                    'publish_attempts' => 0,
                ]);
            } catch (\Throwable $exception) {
                Log::warning('[AppQyV1TranslationEvent] outbox append failed', [
                    'event' => $event,
                    'error' => $exception->getMessage(),
                ]);
            }
        }, AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1));
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

    /**
     * Fetch up to $limit events with id > $cursor, oldest first. Each item is
     * ['id' => int, 'event' => string, 'data' => array].
     */
    public static function since(int $cursor, int $limit = 200): array
    {
        $rows = static::query()
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

    /** Highest event id currently stored (0 when empty). New clients start here. */
    public static function maxId(): int
    {
        return (int) static::query()->max('id');
    }

    /**
     * Delete events older than $seconds. Best-effort; returns deleted row count.
     * The publisher calls this occasionally to keep the outbox bounded.
     */
    public static function pruneOlderThan(int $seconds = 600): int
    {
        try {
            return (int) static::query()
                ->whereNotNull('published_at')
                ->where('published_at', '<', now()->subSeconds($seconds))
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1TranslationEvent] outbox prune failed', [
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }
}
