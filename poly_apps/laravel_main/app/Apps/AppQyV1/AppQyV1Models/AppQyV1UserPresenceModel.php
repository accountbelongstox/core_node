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
 * Heartbeat-written presence (SOCIAL_FEATURE_SPECIFICATION.md §1/§4). One row per
 * user (unique user_id). On READ, last_seen_at older than STALE_SECONDS is
 * effectively offline regardless of the stored status. created_at only is not
 * tracked (heartbeat upsert sets last_seen_at + updated_at).
 */
class AppQyV1UserPresenceModel extends Model
{
    public const STATUS_ONLINE = 'online';
    public const STATUS_AWAY = 'away';
    public const STATUS_STUDYING = 'studying';
    public const STATUS_OFFLINE = 'offline';

    /** A presence row older than this many seconds reads as offline. */
    public const STALE_SECONDS = 60;

    // No created_at; updated_at is set explicitly on heartbeat upsert.
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('USER_PRESENCE');
    }

    protected $fillable = [
        'user_id',
        'status',
        'last_seen_at',
        'updated_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'last_seen_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Upsert a heartbeat. Returns the PREVIOUS effective-online state so the
     * caller can detect an offline->online transition (to emit friend.online).
     *
     * @return array{previously_online: bool, status: string}
     */
    public static function heartbeat(int $userId, ?string $status = null): array
    {
        $now = now();
        $existing = static::query()->where('user_id', $userId)->first();
        $previouslyOnline = $existing !== null && self::isFresh($existing->last_seen_at);

        $newStatus = ($status !== null && $status !== '') ? $status : self::STATUS_ONLINE;

        static::query()->updateOrCreate(
            ['user_id' => $userId],
            [
                'status' => $newStatus,
                'last_seen_at' => $now,
                'updated_at' => $now,
            ]
        );

        return [
            'previously_online' => $previouslyOnline,
            'status' => $newStatus,
        ];
    }

    /**
     * Effective presence for a batch of user ids: { id => {status, last_seen_at} }.
     * A stale heartbeat (older than STALE_SECONDS) collapses to 'offline'.
     *
     * @param array<int, int> $userIds
     * @return array<int, array{status: string, last_seen_at: ?string}>
     */
    public static function effectiveFor(array $userIds): array
    {
        $out = [];
        if (empty($userIds)) {
            return $out;
        }

        $rows = static::query()->whereIn('user_id', $userIds)->get(['user_id', 'status', 'last_seen_at']);
        foreach ($rows as $row) {
            $fresh = self::isFresh($row->last_seen_at);
            $out[(int) $row->user_id] = [
                'status' => $fresh ? (string) $row->status : self::STATUS_OFFLINE,
                'last_seen_at' => $row->last_seen_at ? $row->last_seen_at->toISOString() : null,
            ];
        }

        // Users with no presence row at all read as offline.
        foreach ($userIds as $id) {
            if (!isset($out[(int) $id])) {
                $out[(int) $id] = ['status' => self::STATUS_OFFLINE, 'last_seen_at' => null];
            }
        }
        return $out;
    }

    /** Whether a last_seen_at value is within the freshness window. */
    public static function isFresh($lastSeenAt): bool
    {
        if (!$lastSeenAt) {
            return false;
        }
        return \Illuminate\Support\Carbon::parse($lastSeenAt)->gt(now()->subSeconds(self::STALE_SECONDS));
    }
}
