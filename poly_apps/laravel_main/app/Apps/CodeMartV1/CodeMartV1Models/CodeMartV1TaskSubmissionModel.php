<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class CodeMartV1TaskSubmissionModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
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

    public static function pendingReviewRows(int $reviewerId, int $limit = 10): Collection
    {
        $model = new self();

        return $model->getConnection()
            ->table('codemart_v1_code_submissions')
            ->whereNotExists(function ($query) use ($reviewerId) {
                $query->select('id')
                    ->from('codemart_v1_code_reviews')
                    ->whereColumn('codemart_v1_code_reviews.submission_id', 'codemart_v1_code_submissions.id')
                    ->where('codemart_v1_code_reviews.reviewer_id', $reviewerId);
            })
            ->where('status', 'completed')
            ->limit($limit)
            ->get();
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
