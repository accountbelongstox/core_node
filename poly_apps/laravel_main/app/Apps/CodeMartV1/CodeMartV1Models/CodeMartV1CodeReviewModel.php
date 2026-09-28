<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1CodeReviewModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_code_reviews';

    protected $fillable = [
        'task_submission_id',
        'reviewer_id',
        'review_notes',
        'status',
        'rating',
        'line_comments',
        'quality_rating',
        'readability_rating',
        'efficiency_rating',
        'security_rating',
        'comments',
        'review_kind',
        'recommendation',
        'code_score',
    ];

    protected $casts = [
        'line_comments' => 'json',
        'code_score' => 'decimal:2',
    ];

    /** Mean of the given 1..5 dimension ratings mapped onto the code score scale. */
    public static function codeScoreFromRatings(array $ratings): float
    {
        $values = array_values(array_filter($ratings, static fn ($value): bool => $value !== null));
        if ($values === []) {
            return 0.0;
        }
        $mean = array_sum($values) / count($values);

        return round($mean / CodeMartV1Constants::MAX_RATING * CodeMartV1Constants::CODE_SCORE_SCALE, 2);
    }

    /** Advisory recommendation derived from the mean dimension rating. */
    public static function derivedRecommendation(array $ratings): string
    {
        $values = array_values(array_filter($ratings, static fn ($value): bool => $value !== null));
        $mean = $values === [] ? 0 : array_sum($values) / count($values);
        if ($mean >= CodeMartV1Constants::REVIEW_RECOMMEND_APPROVE_MIN) {
            return CodeMartV1Constants::SUBMISSION_STATUS_APPROVED;
        }
        if ($mean >= CodeMartV1Constants::REVIEW_RECOMMEND_REVISION_MIN) {
            return CodeMartV1Constants::SUBMISSION_STATUS_NEEDS_REVISION;
        }

        return CodeMartV1Constants::SUBMISSION_STATUS_REJECTED;
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1TaskSubmissionModel::class, 'task_submission_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'reviewer_id');
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function needsRevision(): bool
    {
        return $this->status === 'needs_revision';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    public static function findForSubmissionReviewer(int $submissionId, int $reviewerId): ?self
    {
        return static::query()
            ->where('task_submission_id', $submissionId)
            ->where('reviewer_id', $reviewerId)
            ->first();
    }
}
