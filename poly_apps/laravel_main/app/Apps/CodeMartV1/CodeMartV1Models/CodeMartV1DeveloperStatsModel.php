<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;

class CodeMartV1DeveloperStatsModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_developer_stats';

    protected $fillable = [
        'user_id',
        'completed_projects',
        'completed_tasks',
        'avg_code_score',
        'avg_client_satisfaction',
        'total_earnings',
        'on_time_delivery_rate',
    ];

    protected $casts = [
        'completed_projects' => 'integer',
        'completed_tasks' => 'integer',
        'avg_code_score' => 'decimal:2',
        'avg_client_satisfaction' => 'decimal:2',
        'total_earnings' => 'decimal:2',
        'on_time_delivery_rate' => 'decimal:2',
    ];

    public static function forUser(int $userId): ?self
    {
        return static::query()->where('user_id', $userId)->first();
    }

    private static function lockOrCreate(int $userId): self
    {
        $stats = static::query()->where('user_id', $userId)->lockForUpdate()->first();

        return $stats ?? static::query()->create(['user_id' => $userId]);
    }

    /**
     * Recompute delivery statistics from the ledger of record: completed
     * tasks, reviewer code scores, client ratings, and on-time delivery.
     * $earnedAmount is added to total_earnings (released escrow net amount).
     */
    public static function recalculateForUser(int $userId, float $earnedAmount = 0.0): self
    {
        $submissionsTable = CodeMartV1TablesMaps::CODEMART_TASK_SUBMISSIONS_TABLE;
        $reviewsTable = CodeMartV1TablesMaps::CODEMART_CODE_REVIEWS_TABLE;
        $connection = (new static())->getConnection();

        $completedTasks = CodeMartV1TaskModel::query()
            ->where('assigned_to', $userId)
            ->where('status', CodeMartV1Constants::TASK_STATUS_COMPLETED);
        $completedCount = (clone $completedTasks)->count();
        $onTimeCount = (clone $completedTasks)
            ->where(function ($query): void {
                $query->whereNull('due_date')
                    ->orWhereNull('completed_at')
                    ->orWhereColumn('completed_at', '<=', 'due_date');
            })
            ->count();

        $codeScore = $connection->table($reviewsTable . ' as r')
            ->join($submissionsTable . ' as s', 's.id', '=', 'r.task_submission_id')
            ->where('s.submitted_by', $userId)
            ->where(function ($query): void {
                $query->where('r.review_kind', CodeMartV1Constants::REVIEW_KIND_REVIEWER)
                    ->orWhere(function ($legacy): void {
                        $legacy->whereNull('r.review_kind')->whereNotNull('r.quality_rating');
                    });
            })
            ->selectRaw(
                'AVG(COALESCE(r.code_score, (r.quality_rating + r.readability_rating + r.efficiency_rating) / 3.0 / ? * ?)) AS score',
                [CodeMartV1Constants::MAX_RATING, CodeMartV1Constants::CODE_SCORE_SCALE]
            )
            ->value('score');

        $satisfaction = $connection->table($reviewsTable . ' as r')
            ->join($submissionsTable . ' as s', 's.id', '=', 'r.task_submission_id')
            ->where('s.submitted_by', $userId)
            ->whereNotNull('r.rating')
            ->where(function ($query): void {
                $query->where('r.review_kind', CodeMartV1Constants::REVIEW_KIND_CLIENT)
                    ->orWhere(function ($legacy): void {
                        $legacy->whereNull('r.review_kind')->whereNull('r.quality_rating');
                    });
            })
            ->avg('r.rating');

        $stats = self::lockOrCreate($userId);
        $stats->updateRecord([
            'completed_tasks' => $completedCount,
            'avg_code_score' => round((float) ($codeScore ?? 0), 2),
            'avg_client_satisfaction' => round((float) ($satisfaction ?? 0), 2),
            'on_time_delivery_rate' => $completedCount > 0
                ? round($onTimeCount / $completedCount * CodeMartV1Constants::CODE_SCORE_SCALE, 2)
                : 0,
            'total_earnings' => round((float) $stats->total_earnings + $earnedAmount, 2),
        ]);

        return $stats;
    }

    /** Project completion: every developer who completed a task gains one project. */
    public static function recordProjectCompletion(array $userIds): void
    {
        foreach (array_values(array_unique($userIds)) as $userId) {
            $stats = self::lockOrCreate((int) $userId);
            $stats->updateRecord(['completed_projects' => (int) $stats->completed_projects + 1]);
        }
    }
}
