<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodeMartV1TaskSubmissionModel extends Model
{
    protected $table = 'codemart_v1_task_submissions';

    protected $fillable = [
        'task_id',
        'submitted_by',
        'submission_note',
        'files',
        'status',
    ];

    protected $casts = [
        'files' => 'json',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1TaskModel::class, 'task_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'submitted_by');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(CodeMartV1CodeReviewModel::class, 'task_submission_id');
    }

    public function latestReview(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(CodeMartV1CodeReviewModel::class, 'task_submission_id')->latestOfMany();
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function needsRevision(): bool
    {
        return $this->status === 'needs_revision';
    }
}
