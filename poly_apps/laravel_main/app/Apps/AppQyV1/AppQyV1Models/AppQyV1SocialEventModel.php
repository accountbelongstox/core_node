<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\Log;

/**
 * Per-user real-time event outbox for the social subsystem (replaces Reverb).
 * Mirrors AppQyV1TranslationEventModel but PER RECIPIENT: each row's user_id is
 * the recipient whose SSE stream (/social/stream) drains rows id > cursor for
 * THAT user only. `data` holds the JSON-encoded payload.
 */
class AppQyV1SocialEventModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    // created_at only (append-only log); no updated_at column.
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'event',
        'data',
        'created_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('SOCIAL_EVENTS');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * Append one event addressed to $userId (the RECIPIENT). Best-effort: a write
     * failure is logged and swallowed so it can never break the action that
     * triggered it. `$data` is stored as a JSON string (the SSE payload).
     */
    public static function emit(int $userId, string $event, array $data): void
    {
        try {
            static::query()->create([
                'user_id' => $userId,
                'event' => $event,
                'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1SocialEvent] outbox emit failed', [
                'user_id' => $userId,
                'event' => $event,
                'error' => $e->getMessage(),
            ]);
        }
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

    /** Highest event id for $userId (0 when none). A fresh SSE client starts here. */
    public static function maxId(int $userId): int
    {
        return (int) static::query()->where('user_id', $userId)->max('id');
    }

    /**
     * Delete events older than $seconds (across all users). Best-effort; returns
     * deleted row count. The stream loop calls this occasionally to stay bounded.
     */
    public static function pruneOlderThan(int $seconds = 600): int
    {
        try {
            return (int) static::query()
                ->where('created_at', '<', now()->subSeconds($seconds))
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1SocialEvent] outbox prune failed', [
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }
}
