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
    /**
     * @param array{complexity:string,platforms:int,features:int,budget_type:string} $input
     */
    public function estimate(array $input): array
    {
        $formula = CodeMartV1PolicyService::all();
        [$minPlatforms, $maxPlatforms] = $formula['estimate_platforms_range'];
        [$minFeatures, $maxFeatures] = $formula['estimate_features_range'];

        $complexity = $input['complexity'];
        $platforms = max($minPlatforms, min($maxPlatforms, $input['platforms']));
        $features = max($minFeatures, min($maxFeatures, $input['features']));
        $budgetType = $input['budget_type'] === CodeMartV1Constants::BUDGET_TYPE_HOURLY
            ? CodeMartV1Constants::BUDGET_TYPE_HOURLY
            : CodeMartV1Constants::BUDGET_TYPE_FIXED;

        $baseHours = $formula['estimate_base_hours'][$complexity];
        $rate = $formula['estimate_hourly_rates'][$complexity];

        $platformMultiplier = 1 + ($platforms - 1) * $formula['estimate_platform_factor'];
        $featureMultiplier = 1 + ($features - 1) * $formula['estimate_feature_factor'];

        $hoursMin = (int) round($baseHours * $platformMultiplier * $featureMultiplier * $formula['estimate_range_low']);
        $hoursMax = (int) round($baseHours * $platformMultiplier * $featureMultiplier * $formula['estimate_range_high']);

        $costMin = $hoursMin * $rate;
        $costMax = $hoursMax * $rate;

        $weeksMin = max(1, (int) floor($hoursMin / $formula['estimate_week_hours_fast']));
        $weeksMax = max($weeksMin + 1, (int) ceil($hoursMax / $formula['estimate_week_hours_slow']));

        $team = $formula['estimate_team'][$complexity];
        $teamRoles = [];
        foreach (array_count_values($team) as $role => $count) {
            $teamRoles[] = ['role' => $role, 'count' => $count];
        }

        return [
            'complexity' => $complexity,
            'platforms' => $platforms,
            'features' => $features,
            'budget_type' => $budgetType,
            'currency' => CodeMartV1PolicyService::aiEstimateCurrency(),
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
                ? number_format($rate * $formula['estimate_hourly_rate_low'], 2, '.', '')
                : null,
            'hourly_rate_max' => $budgetType === CodeMartV1Constants::BUDGET_TYPE_HOURLY
                ? number_format($rate * $formula['estimate_hourly_rate_high'], 2, '.', '')
                : null,
            'platform_commission_rate' => CodeMartV1PolicyService::commissionRate(),
        ];
    }

    /** Input bounds and defaults for the public estimate form. */
    public function limits(): array
    {
        [$minPlatforms, $maxPlatforms, $defaultPlatforms] = CodeMartV1PolicyService::list('estimate_platforms_range');
        [$minFeatures, $maxFeatures, $defaultFeatures] = CodeMartV1PolicyService::list('estimate_features_range');

        return [
            'platforms' => ['min' => $minPlatforms, 'max' => $maxPlatforms, 'default' => $defaultPlatforms],
            'features' => ['min' => $minFeatures, 'max' => $maxFeatures, 'default' => $defaultFeatures],
        ];
    }

    public function defaults(): array
    {
        $limits = $this->limits();

        return [
            'complexities' => CodeMartV1Constants::COMPLEXITIES,
            'budget_types' => [
                CodeMartV1Constants::BUDGET_TYPE_FIXED,
                CodeMartV1Constants::BUDGET_TYPE_HOURLY,
            ],
            'currency' => CodeMartV1PolicyService::aiEstimateCurrency(),
            'platforms' => $limits['platforms'],
            'features' => $limits['features'],
            'max_platforms' => $limits['platforms']['max'],
            'max_features' => $limits['features']['max'],
            'default_complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'default_budget_type' => CodeMartV1Constants::BUDGET_TYPE_FIXED,
        ];
    }
}
