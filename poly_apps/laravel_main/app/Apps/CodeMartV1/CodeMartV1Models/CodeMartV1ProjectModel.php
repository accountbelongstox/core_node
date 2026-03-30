<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CodeMartV1ProjectModel extends Model
{
    protected $connection = AppKeys::CODEMARTV1;
    protected $table = 'codemart_v1_projects';

    protected $fillable = [
        'client_id',
        'title',
        'description',
        'status',
        'complexity',
        'budget',
        'budget_type',
        'currency',
        'start_date',
        'end_date',
        'skills',
        'languages',
        'frameworks',
        'databases',
        'reference_urls',
        'total_milestones',
        'completed_milestones',
    ];

    protected $casts = [
        'skills' => 'json',
        'languages' => 'json',
        'frameworks' => 'json',
        'databases' => 'json',
        'reference_urls' => 'json',
        'start_date' => 'date',
        'end_date' => 'date',
        'budget' => 'decimal:2',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'client_id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(CodeMartV1MilestoneModel::class, 'project_id');
    }

    public function proposal(): HasOne
    {
        return $this->hasOne(CodeMartV1ProjectProposalModel::class, 'project_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(CodeMartV1ProjectAttachmentModel::class, 'project_id');
    }

    public function currentMilestone(): HasOne
    {
        return $this->hasOne(CodeMartV1MilestoneModel::class, 'project_id')
            ->where('status', '!=', 'completed')
            ->orderBy('order', 'asc');
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
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
