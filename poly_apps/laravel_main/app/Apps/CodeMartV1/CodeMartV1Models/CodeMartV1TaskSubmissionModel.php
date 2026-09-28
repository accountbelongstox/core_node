<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodeMartV1TaskSubmissionModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_task_submissions';

    protected $fillable = [
        'task_id',
        'submitted_by',
        'submission_note',
        'files',
        'status',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'files' => 'json',
        'reviewed_at' => 'datetime',
    ];

    /** Private storage paths never leave the server; files are addressed by index. */
    public function toArray(): array
    {
        $data = parent::toArray();
        if (isset($data['files']) && is_array($data['files'])) {
            $data['files'] = self::publicFileDescriptors($data['files']);
        }

        return $data;
    }

    public static function publicFileDescriptors(array $files): array
    {
        $public = [];
        foreach (array_values($files) as $index => $file) {
            $descriptor = is_array($file) ? $file : ['url' => (string) $file];
            unset($descriptor['path']);
            $descriptor['index'] = $index;
            $public[] = $descriptor;
        }

        return $public;
    }

    public function fileAt(int $index): ?array
    {
        $files = array_values(is_array($this->files) ? $this->files : []);
        $file = $files[$index] ?? null;

        return is_array($file) ? $file : null;
    }

    public function isReviewable(): bool
    {
        return in_array($this->status, CodeMartV1Constants::SUBMISSION_REVIEWABLE_STATUSES, true);
    }

    public static function lockById(int $submissionId): ?self
    {
        return static::query()->whereKey($submissionId)->lockForUpdate()->first();
    }

    public static function pageForTask(int $taskId, int $page, int $pageSize): array
    {
        $query = static::query()
            ->with(['submitter:id,name', 'reviews' => fn ($reviews) => $reviews->latest(), 'reviews.reviewer:id,name'])
            ->where('task_id', $taskId)
            ->latest();

        return self::paginateQuery($query, 'submissions', $page, $pageSize);
    }

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

    /** Reviewable submissions this reviewer has not reviewed and did not author. */
    public static function pendingReviewPage(int $reviewerId, int $page, int $pageSize): array
    {
        $table = (new self())->getTable();
        $reviewsTable = CodeMartV1TablesMaps::CODEMART_CODE_REVIEWS_TABLE;
        $query = static::query()
            ->with(['task:id,milestone_id,title,description,required_skills,status'])
            ->where('submitted_by', '!=', $reviewerId)
            ->whereIn('status', CodeMartV1Constants::SUBMISSION_REVIEWABLE_STATUSES)
            ->whereNotExists(function ($query) use ($reviewerId, $table, $reviewsTable) {
                $query->select('id')
                    ->from($reviewsTable)
                    ->whereColumn($reviewsTable . '.task_submission_id', $table . '.id')
                    ->where($reviewsTable . '.reviewer_id', $reviewerId);
            })
            ->orderBy('created_at');

        return self::paginateQuery($query, 'submissions', $page, $pageSize);
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
