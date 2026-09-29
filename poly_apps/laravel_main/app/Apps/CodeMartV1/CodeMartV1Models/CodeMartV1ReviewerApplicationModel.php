<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;

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
        'revoked_at',
        'revoked_by',
        'revoke_reason',
    ];

    protected $casts = [
        'similarity_score' => 'decimal:2',
        'completed_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public static function recentForUser(int $userId, int $days): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('created_at', '>', now()->subDays($days))
            ->orderByDesc('id')
            ->first();
    }

    public static function findOwnedInProgress(int $applicationId, int $userId): ?self
    {
        return static::query()
            ->whereKey($applicationId)
            ->where('user_id', $userId)
            ->where('status', CodeMartV1Constants::REVIEWER_APPLICATION_IN_PROGRESS)
            ->first();
    }
}
