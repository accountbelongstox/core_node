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

/**
 * Live viewer presence (Social Center expansion §LIVE heartbeat). One row per
 * (session_id, user_id); last_seen_at bumped by the viewer heartbeat.
 * viewer_count is derived from rows fresh within STALE_SECONDS (mirrors the
 * user_presence 60s rule). No timestamps managed by Eloquent (last_seen_at set
 * explicitly).
 */
class AppQyV1LiveViewerModel extends Model
{
    /** A viewer row older than this many seconds is no longer counted. */
    public const STALE_SECONDS = 60;

    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('LIVE_VIEWERS');
    }

    protected $fillable = [
        'session_id',
        'user_id',
        'last_seen_at',
    ];

    protected $casts = [
        'session_id' => 'integer',
        'user_id' => 'integer',
        'last_seen_at' => 'datetime',
    ];

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
