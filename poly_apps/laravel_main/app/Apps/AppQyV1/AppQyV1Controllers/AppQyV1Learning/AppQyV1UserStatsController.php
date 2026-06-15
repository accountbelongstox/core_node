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

        $baseQuery = AppQyV1UserLearningProgressModel::where('user_id', $userId);
        if (is_string($language) && $language !== '') {
            $baseQuery->where('lang_code', $language);
        }

        $totalWords = (clone $baseQuery)->count();

        $masteredCount = (clone $baseQuery)
            ->where('learning_status', 'mastered')
            ->count();

        $criticalCount = (clone $baseQuery)
            ->whereIn('learning_status', ['learning', 'reviewing'])
            ->where('next_review_at', '<=', now())
            ->count();

        $reviewCount = (clone $baseQuery)
            ->whereIn('learning_status', ['learning', 'reviewing'])
            ->where(function ($query) {
                $query->where('next_review_at', '>', now())
                    ->orWhereNull('next_review_at');
            })
            ->count();

        $learningCount = (clone $baseQuery)
            ->where('learning_status', 'new')
            ->count();

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
