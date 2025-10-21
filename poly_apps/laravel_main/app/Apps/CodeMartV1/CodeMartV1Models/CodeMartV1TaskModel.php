<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CodeMartV1TaskModel extends Model
{
    protected $table = 'codemart_tasks';

    protected $fillable = [
        'milestone_id',
        'title',
        'description',
        'status',
        'priority',
        'assigned_to',
        'due_date',
        'deliverables',
        'budget_allocation',
        'order',
    ];

    protected $casts = [
        'deliverables' => 'json',
        'due_date' => 'datetime',
    ];

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1MilestoneModel::class, 'milestone_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'assigned_to');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(CodeMartV1TaskSubmissionModel::class, 'task_id');
    }

    public function latestSubmission(): HasOne
    {
        return $this->hasOne(CodeMartV1TaskSubmissionModel::class, 'task_id')->latestOfMany();
    }

    public function comments(): HasMany
    {
        return $this->hasMany(CodeMartV1TaskCommentModel::class, 'task_id');
    }
}
