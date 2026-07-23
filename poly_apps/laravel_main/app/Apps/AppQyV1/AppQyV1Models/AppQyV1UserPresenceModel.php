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
        'latitude',
        'longitude',
        'location_accuracy',
        'location_visible',
        'location_updated_at',
        'updated_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'last_seen_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
        'location_accuracy' => 'float',
        'location_visible' => 'boolean',
        'location_updated_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function updateLocation(int $userId, float $latitude, float $longitude, ?float $accuracy, bool $visible): void
    {
        $now = now();
        static::query()->updateOrCreate(
            ['user_id' => $userId],
            [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'location_accuracy' => $accuracy,
                'location_visible' => $visible,
                'location_updated_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    public static function setLocationVisibility(int $userId, bool $visible): void
    {
        static::query()->where('user_id', $userId)->update([
            'location_visible' => $visible,
            'updated_at' => now(),
        ]);
    }

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

    /**
     * The user ids that should learn about $userId's presence transitions: the
     * accepted friends PLUS the followers (people who follow this user) — exactly
     * the relationships that render this user's presence dot. Shared by the
     * heartbeat online-push and the offline sweep so both notify the same audience.
     *
     * @return array<int, int>
     */
    public static function audienceFor(int $userId): array
    {
        $ids = [];
        foreach (AppQyV1FriendRequestModel::acceptedFriendIds($userId) as $id) {
            $ids[$id] = $id;
        }
        // People who follow this user (their friends list shows this user).
        $followerIds = AppQyV1UserFollowModel::query()
            ->where('followed_user_id', $userId)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        foreach ($followerIds as $id) {
            $ids[$id] = $id;
        }
        unset($ids[$userId]);
        return array_values($ids);
    }

    /**
     * Detect users who JUST crossed the offline threshold and mark them offline,
     * returning each transition so the caller can push friend.offline. A user is
     * "newly offline" when their stored status is still a live value yet their
     * last_seen_at is now older than STALE_SECONDS (i.e. their heartbeat lapsed).
     *
     * Exactly-once per transition: the stored `status` column doubles as the
     * emitted marker. Each candidate is claimed with a CONDITIONAL update
     * (status != offline AND still stale -> offline); only the tick whose update
     * affects the row reports the transition, so concurrent ticks never double
     * emit and no extra column/migration is needed. A later heartbeat flips the
     * status back to a live value (last_seen_at stays stale until then), which
     * re-arms the next offline detection and lets heartbeat() emit friend.online.
     *
     * @return array<int, array{user_id:int, last_seen_at:?string}>
     */
    public static function sweepNewlyOffline(int $limit = 500): array
    {
        $threshold = now()->subSeconds(self::STALE_SECONDS);
        $transitioned = [];
        $candidates = static::query()
            ->where('status', '!=', self::STATUS_OFFLINE)
            ->where('last_seen_at', '<', $threshold)
            ->orderBy('user_id')
            ->limit($limit)
            ->get(['user_id', 'last_seen_at']);

        foreach ($candidates as $row) {
            $uid = (int) $row->user_id;
            // Atomic claim: only the tick that actually flips the row (affected
            // rows >= 1) owns this transition. last_seen_at is left untouched so
            // it keeps reflecting the real last heartbeat.
            $claimed = static::query()
                ->where('user_id', $uid)
                ->where('status', '!=', self::STATUS_OFFLINE)
                ->where('last_seen_at', '<', $threshold)
                ->update([
                    'status' => self::STATUS_OFFLINE,
                    'updated_at' => now(),
                ]);
            if ($claimed >= 1) {
                $transitioned[] = [
                    'user_id' => $uid,
                    'last_seen_at' => $row->last_seen_at ? $row->last_seen_at->toISOString() : null,
                ];
            }
        }
        return $transitioned;
    }
}
