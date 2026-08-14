<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Traits\ApiResponse;

class AppQyV1UserStatsController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function retention(Request $request): JsonResponse
    {
        $userId = Auth::id();

        $language = $request->input('language');

        $counts = AppQyV1UserLearningProgressModel::retentionCounts(
            (int) $userId,
            is_string($language) ? $language : null
        );
        $totalWords = $counts['total'];
        $masteredCount = $counts['mastered'];
        $criticalCount = $counts['critical'];
        $reviewCount = $counts['review'];
        $learningCount = $counts['learning'];

        $buckets = [
            ['level' => 'Critical', 'count' => $criticalCount, 'color' => 'bg-red-500'],
            ['level' => 'Review', 'count' => $reviewCount, 'color' => 'bg-yellow-500'],
            ['level' => 'Learning', 'count' => $learningCount, 'color' => 'bg-blue-500'],
            ['level' => 'Mastered', 'count' => $masteredCount, 'color' => 'bg-green-500'],
        ];

        $stats = [];
        foreach ($buckets as $bucket) {
            $percentage = 0;
            if ($totalWords > 0) {
                $percentage = (int) round(($bucket['count'] / $totalWords) * 100);
            }
            $stats[] = [
                'level' => $bucket['level'],
                'count' => $bucket['count'],
                'color' => $bucket['color'],
                'percentage' => $percentage,
            ];
        }

        return $this->success($stats, 'Retention stats retrieved successfully');
    }
}
