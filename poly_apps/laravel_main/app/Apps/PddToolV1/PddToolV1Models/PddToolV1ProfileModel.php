<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Models;

use App\Models\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Apps\PddToolV1\PddToolV1Constants\PddToolV1Defaults;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * PddToolV1 (订多多) membership PROFILE.
 *
 * Identity (username / password / Sanctum tokens) lives ONCE in the global
 * `users` table (App\Models\User, connection `main`). This profile holds the
 * PddToolV1-specific membership data, keyed by `user_id` (= global users.id), on
 * the per-app `pddtoolv1` connection. One row per user.
 *
 * Auth is NOT done here anymore: the route is guarded by `custom.authenticate`
 * (Sanctum bearer token) and the controller resolves the User via
 * $request->user(), then loads/creates this profile via PddToolV1ProfileResolver.
 */
class PddToolV1ProfileModel extends Model
{
    protected $appKey = AppKeys::PDDTOOLV1;
    protected $table;

    /**
     * Keyed by user_id (the global users.id). Not auto-incrementing.
     */
    protected $primaryKey = 'user_id';
    public $incrementing = false;
    protected $keyType = 'int';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = PddToolV1TableMaps::getTableName('PROFILES');
    }

    protected $fillable = [
        'user_id',
        'package_name',
        'payment_model',
        'valid_until',
        'max_orders',
        'max_pdd_accounts',
        'points',
        'invite_code',
        'app_type',
        'acquisition_source',
        'disabled',
        'last_login',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'valid_until' => 'datetime',
        'max_orders' => 'integer',
        'max_pdd_accounts' => 'integer',
        'points' => 'float',
        'disabled' => 'boolean',
        'last_login' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function adminStats($now): array
    {
        return [
            'users_total' => static::query()->count(),
            'users_active' => static::query()
                ->where('disabled', false)
                ->where('valid_until', '>', $now)
                ->count(),
            'expiring_7d' => static::query()
                ->whereBetween('valid_until', [$now, $now->copy()->addDays(7)])
                ->count(),
        ];
    }

    public static function adminPage(
        array $matchingUserIds,
        bool $filterByUserIds,
        string $package,
        ?bool $expired,
        int $page,
        int $perPage
    ): array {
        $query = static::query();

        if ($filterByUserIds) {
            $query->whereIn('user_id', $matchingUserIds);
        }
        if ($package !== '') {
            $query->where('package_name', $package);
        }
        if ($expired !== null) {
            $query->where('valid_until', $expired ? '<=' : '>', now());
        }

        return [
            'total' => (clone $query)->count(),
            'rows' => $query->orderByDesc('user_id')->forPage($page, $perPage)->get(),
        ];
    }

    public static function findByUserId(int $userId): ?self
    {
        return static::query()->where('user_id', $userId)->first();
    }

    public static function existsForUser(int $userId): bool
    {
        return static::query()->where('user_id', $userId)->exists();
    }

    public static function expiringWithinDays(int $days): Collection
    {
        return static::query()
            ->whereBetween('valid_until', [now(), now()->addDays($days)])
            ->orderBy('valid_until')
            ->get();
    }

    /**
     * Get-or-create the profile for a user id and force it to the ULTIMATE /
     * non-expiring / unlimited tier. Used by the super-code free-unlock path so
     * authenticated calls validate against a real DB row.
     */
    public static function ensureUltimate(int $userId): self
    {
        $ultimate = PddToolV1Defaults::PACKAGES[PddToolV1Defaults::ULTIMATE];

        /** @var self $profile */
        $profile = self::query()->firstOrNew(['user_id' => $userId]);
        $profile->user_id = $userId;
        $profile->package_name = PddToolV1Defaults::ULTIMATE;
        $profile->payment_model = 'SUBSCRIPTION';
        $profile->valid_until = now()->addYears(75);
        $profile->max_orders = (int) $ultimate['max_orders'];
        $profile->max_pdd_accounts = (int) $ultimate['max_pdd_accounts'];
        $profile->disabled = false;
        if (empty($profile->invite_code)) {
            $profile->invite_code = strtoupper(Str::random(8));
        }
        if (empty($profile->points)) {
            $profile->points = 0;
        }
        try {
            $profile->save();
        } catch (QueryException $e) {
            // Concurrent request already inserted the row (unique user_id) — reuse it.
            $existing = self::query()->where('user_id', $userId)->first();
            if (!$existing) {
                throw $e;
            }
            $existing->package_name = PddToolV1Defaults::ULTIMATE;
            $existing->payment_model = 'SUBSCRIPTION';
            $existing->valid_until = now()->addYears(75);
            $existing->max_orders = (int) $ultimate['max_orders'];
            $existing->max_pdd_accounts = (int) $ultimate['max_pdd_accounts'];
            $existing->disabled = false;
            $existing->save();
            return $existing;
        }

        return $profile;
    }

    /**
     * Get-or-create a TRIAL profile for a user id (idempotent). Used the first
     * time an authenticated user without a profile hits a protected route, and at
     * registration time.
     */
    public static function ensureTrial(int $userId, array $overrides = []): self
    {
        $trial = PddToolV1Defaults::PACKAGES[PddToolV1Defaults::DEFAULT_PACKAGE];

        /** @var self $profile */
        $profile = self::query()->firstOrNew(['user_id' => $userId]);
        if (!$profile->exists) {
            $profile->user_id = $userId;
            $profile->package_name = PddToolV1Defaults::DEFAULT_PACKAGE;
            $profile->payment_model = PddToolV1Defaults::DEFAULT_PAYMENT_MODEL;
            $profile->valid_until = now()->addDays(PddToolV1Defaults::DEFAULT_TRIAL_DAYS);
            $profile->max_orders = (int) $trial['max_orders'];
            $profile->max_pdd_accounts = (int) $trial['max_pdd_accounts'];
            $profile->points = 0;
            $profile->invite_code = strtoupper(Str::random(8));
            $profile->app_type = (string) ($overrides['app_type'] ?? '');
            $profile->acquisition_source = (string) ($overrides['acquisition_source'] ?? '');
            $profile->disabled = false;
            try {
                $profile->save();
            } catch (QueryException $e) {
                // Concurrent request already created the profile — reuse the existing row.
                $existing = self::query()->where('user_id', $userId)->first();
                if (!$existing) {
                    throw $e;
                }
                return $existing;
            }
        }

        return $profile;
    }
}
