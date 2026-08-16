<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodeMartV1MilestoneModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_milestones';

    protected $fillable = [
        'project_id',
        'title',
        'description',
        'status',
        'order',
        'due_date',
        'budget',
        'deliverables',
        'completed_at',
    ];

    protected $casts = [
        'deliverables' => 'json',
        'due_date' => 'date',
        'completed_at' => 'datetime',
        'budget' => 'decimal:2',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(CodeMartV1TaskModel::class, 'milestone_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }
}
