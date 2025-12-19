<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1CodeReviewModel extends Model
{
    protected $connection = 'codemartv1';
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
}
