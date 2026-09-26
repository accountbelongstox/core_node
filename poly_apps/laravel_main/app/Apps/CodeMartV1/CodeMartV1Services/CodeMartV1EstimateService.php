<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;

/**
 * Server-owned project estimate policy. The public estimate endpoint and the
 * project-estimate page both consume this calculation; the browser never
 * derives pricing truth locally.
 */
class CodeMartV1EstimateService
{
    /** Hourly reference rates (CNY) by complexity tier. */
    private const HOURLY_RATE = [
        CodeMartV1Constants::COMPLEXITY_SIMPLE => 180,
        CodeMartV1Constants::COMPLEXITY_MEDIUM => 260,
        CodeMartV1Constants::COMPLEXITY_COMPLEX => 360,
        CodeMartV1Constants::COMPLEXITY_VERY_COMPLEX => 480,
    ];

    /** Base effort hours by complexity tier. */
    private const BASE_HOURS = [
        CodeMartV1Constants::COMPLEXITY_SIMPLE => 80,
        CodeMartV1Constants::COMPLEXITY_MEDIUM => 240,
        CodeMartV1Constants::COMPLEXITY_COMPLEX => 640,
        CodeMartV1Constants::COMPLEXITY_VERY_COMPLEX => 1280,
    ];

    /** Per-platform effort multiplier step. */
    private const PLATFORM_FACTOR = 0.35;

    /** Per-feature effort multiplier step. */
    private const FEATURE_FACTOR = 0.12;

    /** Effort band around the base estimate. */
    private const RANGE_LOW = 0.85;
    private const RANGE_HIGH = 1.25;

    /** Hourly engagements quote a rate band around the tier rate. */
    private const HOURLY_RATE_LOW = 0.9;
    private const HOURLY_RATE_HIGH = 1.2;

    public const MIN_PLATFORMS = 1;
    public const MAX_PLATFORMS = 6;
    public const MIN_FEATURES = 1;
    public const MAX_FEATURES = 50;
    public const DEFAULT_PLATFORMS = 1;
    public const DEFAULT_FEATURES = 5;

    /** Team composition suggested per complexity tier. */
    private const TEAM = [
        CodeMartV1Constants::COMPLEXITY_SIMPLE => ['developer'],
        CodeMartV1Constants::COMPLEXITY_MEDIUM => ['architect', 'developer', 'reviewer'],
        CodeMartV1Constants::COMPLEXITY_COMPLEX => ['architect', 'developer', 'developer', 'reviewer'],
        CodeMartV1Constants::COMPLEXITY_VERY_COMPLEX => ['architect', 'developer', 'developer', 'developer', 'reviewer'],
    ];

    /**
     * @param array{complexity:string,platforms:int,features:int,budget_type:string} $input
     */
    public function estimate(array $input): array
    {
        $complexity = $input['complexity'];
        $platforms = max(self::MIN_PLATFORMS, min(self::MAX_PLATFORMS, $input['platforms']));
        $features = max(self::MIN_FEATURES, min(self::MAX_FEATURES, $input['features']));
        $budgetType = $input['budget_type'] === CodeMartV1Constants::BUDGET_TYPE_HOURLY
            ? CodeMartV1Constants::BUDGET_TYPE_HOURLY
            : CodeMartV1Constants::BUDGET_TYPE_FIXED;

        $baseHours = self::BASE_HOURS[$complexity];
        $rate = self::HOURLY_RATE[$complexity];

        $platformMultiplier = 1 + ($platforms - 1) * self::PLATFORM_FACTOR;
        $featureMultiplier = 1 + ($features - 1) * self::FEATURE_FACTOR;

        $hoursMin = (int) round($baseHours * $platformMultiplier * $featureMultiplier * self::RANGE_LOW);
        $hoursMax = (int) round($baseHours * $platformMultiplier * $featureMultiplier * self::RANGE_HIGH);

        $costMin = $hoursMin * $rate;
        $costMax = $hoursMax * $rate;

        $weeksMin = max(1, (int) floor($hoursMin / 120));
        $weeksMax = max($weeksMin + 1, (int) ceil($hoursMax / 100));

        $team = self::TEAM[$complexity];
        $teamRoles = [];
        foreach (array_count_values($team) as $role => $count) {
            $teamRoles[] = ['role' => $role, 'count' => $count];
        }

        return [
            'complexity' => $complexity,
            'platforms' => $platforms,
            'features' => $features,
            'budget_type' => $budgetType,
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'estimated_hours_min' => $hoursMin,
            'estimated_hours_max' => $hoursMax,
            'estimated_cost_min' => number_format($costMin, 2, '.', ''),
            'estimated_cost_max' => number_format($costMax, 2, '.', ''),
            'estimated_duration_weeks_min' => $weeksMin,
            'estimated_duration_weeks_max' => $weeksMax,
            'recommended_team' => $team,
            'team_roles' => $teamRoles,
            'hourly_rate' => number_format($rate, 2, '.', ''),
            'hourly_rate_min' => $budgetType === CodeMartV1Constants::BUDGET_TYPE_HOURLY
                ? number_format($rate * self::HOURLY_RATE_LOW, 2, '.', '')
                : null,
            'hourly_rate_max' => $budgetType === CodeMartV1Constants::BUDGET_TYPE_HOURLY
                ? number_format($rate * self::HOURLY_RATE_HIGH, 2, '.', '')
                : null,
            'platform_commission_rate' => CodeMartV1Constants::PLATFORM_COMMISSION_RATE,
        ];
    }

    public function defaults(): array
    {
        return [
            'complexities' => array_keys(self::BASE_HOURS),
            'budget_types' => [
                CodeMartV1Constants::BUDGET_TYPE_FIXED,
                CodeMartV1Constants::BUDGET_TYPE_HOURLY,
            ],
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'platforms' => [
                'min' => self::MIN_PLATFORMS,
                'max' => self::MAX_PLATFORMS,
                'default' => self::DEFAULT_PLATFORMS,
            ],
            'features' => [
                'min' => self::MIN_FEATURES,
                'max' => self::MAX_FEATURES,
                'default' => self::DEFAULT_FEATURES,
            ],
            'max_platforms' => self::MAX_PLATFORMS,
            'max_features' => self::MAX_FEATURES,
            'default_complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'default_budget_type' => CodeMartV1Constants::BUDGET_TYPE_FIXED,
        ];
    }
}
