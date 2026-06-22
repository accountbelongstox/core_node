<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Services;

use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PackageModel;
use App\Apps\PddToolV1\PddToolV1Constants\PddToolV1Defaults;
use Illuminate\Support\Carbon;

/**
 * Grants / extends membership. Source of truth for "applying a package" to a
 * member: extends valid_until by the period and copies package_name + limits
 * from the package row (DB first, falling back to the canonical defaults map).
 */
class PddToolV1MembershipService
{
    /**
     * Resolve a package row (DB override first, then the canonical defaults).
     * Returns the normalized array shape used everywhere or null if unknown.
     */
    public static function resolvePackage(string $code): ?array
    {
        $row = PddToolV1PackageModel::query()->where('code', $code)->first();
        if ($row) {
            return [
                'code' => (string) $row->code,
                'name' => (string) $row->name,
                'price_month' => (float) $row->price_month,
                'price_year' => (float) $row->price_year,
                'max_orders' => (int) $row->max_orders,
                'max_pdd_accounts' => (int) $row->max_pdd_accounts,
                'enabled' => (bool) $row->enabled,
            ];
        }

        if (PddToolV1Defaults::isValidPackage($code)) {
            return PddToolV1Defaults::PACKAGES[$code];
        }

        return null;
    }

    /**
     * Period in days for a month/year billing cycle.
     */
    public static function periodDays(string $period): int
    {
        return $period === 'year' ? 365 : 30;
    }

    /**
     * Price (yuan) for a package + period.
     */
    public static function priceFor(array $package, string $period): float
    {
        return $period === 'year'
            ? (float) ($package['price_year'] ?? 0)
            : (float) ($package['price_month'] ?? 0);
    }

    /**
     * Apply a membership grant to a profile: set package_name + limits and extend
     * valid_until by $grantDays (from now, or from current expiry if still in the
     * future, so paying early stacks rather than truncates). Persists and returns
     * the refreshed profile.
     */
    public static function grant(PddToolV1ProfileModel $profile, string $packageCode, int $grantDays): PddToolV1ProfileModel
    {
        $package = self::resolvePackage($packageCode);

        $base = now();
        if (!empty($profile->valid_until)) {
            try {
                if ($profile->valid_until->isFuture()) {
                    $base = $profile->valid_until;
                }
            } catch (\Throwable $e) {
                $base = now();
            }
        }

        $profile->valid_until = Carbon::parse($base)->addDays(max(1, $grantDays));

        if ($package) {
            $profile->package_name = $package['code'];
            $profile->max_orders = (int) $package['max_orders'];
            $profile->max_pdd_accounts = (int) $package['max_pdd_accounts'];
        }

        $profile->save();

        return $profile->refresh();
    }

    /**
     * Adjust a profile's point balance (recharge balance). Returns the new balance.
     */
    public static function adjustPoints(PddToolV1ProfileModel $profile, float $delta): float
    {
        $profile->points = round((float) ($profile->points ?? 0) + $delta, 2);
        $profile->save();
        return (float) $profile->points;
    }
}
