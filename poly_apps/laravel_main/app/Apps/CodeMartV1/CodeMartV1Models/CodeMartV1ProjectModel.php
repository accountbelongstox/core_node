<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;

class CodeMartV1ProjectModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = 'codemart_v1_projects';

    protected $fillable = [
        'client_id',
        'title',
        'description',
        'status',
        'analysis_status',
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
        'published_at',
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
        'published_at' => 'datetime',
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

    public function latestAnalysis(): HasOne
    {
        return $this->hasOne(CodeMartV1AIAnalysisModel::class, 'project_id')->latestOfMany();
    }

    public function isOwnedBy(int $userId): bool
    {
        return (int) $this->client_id === $userId;
    }

    /** Client or assigned architect: may plan milestones/tasks and review deliverables. */
    public function isManagedBy(int $userId): bool
    {
        return (int) $this->client_id === $userId
            || ($this->architect_id !== null && (int) $this->architect_id === $userId);
    }

    /** owner | architect | assignee | null (no relation). */
    public function accessRoleFor(int $userId): ?string
    {
        if ($this->isOwnedBy($userId)) {
            return CodeMartV1Constants::TRANSITION_ACTOR_OWNER;
        }
        if ($this->architect_id !== null && (int) $this->architect_id === $userId) {
            return CodeMartV1Constants::ROLE_ARCHITECT;
        }
        if (CodeMartV1TaskModel::projectHasAssignee((int) $this->id, $userId)) {
            return CodeMartV1Constants::TRANSITION_ACTOR_ASSIGNEE;
        }

        return null;
    }

    public function acceptsWork(): bool
    {
        return in_array($this->status, CodeMartV1Constants::PROJECT_MARKETPLACE_STATUSES, true);
    }

    /** Manager ids (client and architect) for notifications. */
    public function managerIds(): array
    {
        return array_values(array_filter([
            (int) $this->client_id,
            $this->architect_id !== null ? (int) $this->architect_id : 0,
        ]));
    }

    public static function lockById(int $projectId): ?self
    {
        return static::query()->whereKey($projectId)->lockForUpdate()->first();
    }

    public function currentMilestone(): HasOne
    {
        return $this->hasOne(CodeMartV1MilestoneModel::class, 'project_id')
            ->where('status', '!=', 'completed')
            ->orderBy('order', 'asc');
    }

    public static function architectProjects(int $architectId, int $limit = 20): Collection
    {
        return self::query()
            ->where(function ($query) use ($architectId) {
                $query->where('architect_id', $architectId)
                    ->orWhere(function ($openQuery) {
                        $openQuery->where('status', 'open')->whereNull('architect_id');
                    });
            })
            ->latest('created_at')
            ->limit($limit)
            ->get();
    }

    public static function acceptForArchitect(int $projectId, int $architectId): bool
    {
        return self::query()
            ->whereKey($projectId)
            ->where('status', 'open')
            ->whereNull('architect_id')
            ->update([
                'architect_id' => $architectId,
                'updated_at' => now(),
            ]) === 1;
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

    public static function filteredPage(array $filters, int $page, int $pageSize): array
    {
        $query = static::query();

        foreach (['status', 'complexity'] as $field) {
            if (array_key_exists($field, $filters)) {
                $query->where($field, $filters[$field]);
            }
        }
        if (array_key_exists('search', $filters)) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('title', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        return [
            'total' => (clone $query)->count(),
            'projects' => $query->orderByDesc('created_at')->forPage($page, $pageSize)->get(),
        ];
    }

    public static function findDetailed(int $projectId): ?self
    {
        return static::query()->with([
            'milestones' => fn ($query) => $query->orderBy('order')->orderBy('id'),
            'milestones.tasks' => fn ($query) => $query->orderBy('order')->orderBy('id'),
            'attachments',
        ])->find($projectId);
    }

    public static function findOwnedByClient(int $projectId, int $clientId): ?self
    {
        return static::query()->whereKey($projectId)->where('client_id', $clientId)->first();
    }
}
