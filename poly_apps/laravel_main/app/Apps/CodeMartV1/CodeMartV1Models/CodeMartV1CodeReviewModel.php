<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1CodeReviewModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_code_reviews';

    protected $fillable = [
        'task_submission_id',
        'reviewer_id',
        'review_notes',
        'status',
        'rating',
        'line_comments',
    ];

    protected $casts = [
        'line_comments' => 'json',
    ];

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

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

    public static function findForSubmissionReviewer(int $submissionId, int $reviewerId): ?self
    {
        return static::query()
            ->where('submission_id', $submissionId)
            ->where('reviewer_id', $reviewerId)
            ->first();
    }
}
