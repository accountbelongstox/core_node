<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Utils\RunsModelTransactions;

class CodeMartV1ReviewerApplicationModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = 'codemart_v1_reviewer_applications';

    protected $fillable = [
        'user_id',
        'status',
        'test_cases',
        'user_reviews',
        'similarity_score',
        'completed_at',
    ];

    protected $casts = [
        'similarity_score' => 'decimal:2',
        'completed_at' => 'datetime',
    ];

    public static function recentForUser(int $userId, int $days): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('created_at', '>', now()->subDays($days))
            ->first();
    }

    public static function findOwnedInProgress(int $applicationId, int $userId): ?self
    {
        return static::query()
            ->whereKey($applicationId)
            ->where('user_id', $userId)
            ->where('status', 'in_progress')
            ->first();
    }
}
