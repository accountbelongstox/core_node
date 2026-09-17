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
        $platforms = max(1, min(6, $input['platforms']));
        $features = max(1, min(50, $input['features']));

        $baseHours = self::BASE_HOURS[$complexity];
        $rate = self::HOURLY_RATE[$complexity];

        $platformMultiplier = 1 + ($platforms - 1) * self::PLATFORM_FACTOR;
        $featureMultiplier = 1 + ($features - 1) * 0.12;

        $hoursMin = (int) round($baseHours * $platformMultiplier * $featureMultiplier * 0.85);
        $hoursMax = (int) round($baseHours * $platformMultiplier * $featureMultiplier * 1.25);

        $costMin = $hoursMin * $rate;
        $costMax = $hoursMax * $rate;

        $weeksMin = max(1, (int) floor($hoursMin / 120));
        $weeksMax = max($weeksMin + 1, (int) ceil($hoursMax / 100));

        return [
            'complexity' => $complexity,
            'platforms' => $platforms,
            'features' => $features,
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'estimated_hours_min' => $hoursMin,
            'estimated_hours_max' => $hoursMax,
            'estimated_cost_min' => number_format($costMin, 2, '.', ''),
            'estimated_cost_max' => number_format($costMax, 2, '.', ''),
            'estimated_duration_weeks_min' => $weeksMin,
            'estimated_duration_weeks_max' => $weeksMax,
            'recommended_team' => self::TEAM[$complexity],
            'hourly_rate' => number_format($rate, 2, '.', ''),
            'platform_commission_rate' => CodeMartV1Constants::PLATFORM_COMMISSION_RATE,
        ];
    }

    public function defaults(): array
    {
        return [
            'complexities' => [
                CodeMartV1Constants::COMPLEXITY_SIMPLE,
                CodeMartV1Constants::COMPLEXITY_MEDIUM,
                CodeMartV1Constants::COMPLEXITY_COMPLEX,
                CodeMartV1Constants::COMPLEXITY_VERY_COMPLEX,
            ],
            'budget_types' => [
                CodeMartV1Constants::BUDGET_TYPE_FIXED,
                CodeMartV1Constants::BUDGET_TYPE_HOURLY,
            ],
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'max_platforms' => 6,
            'max_features' => 50,
        ];
    }
}
