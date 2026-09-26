<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CodeMartV1TaskModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = 'codemart_v1_tasks';

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
        'required_skills',
        'assigned_at',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'deliverables' => 'json',
        'required_skills' => 'json',
        'due_date' => 'datetime',
        'assigned_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
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

    public static function marketplacePage(
        array $skills,
        float $minBudget,
        float $maxBudget,
        int $page,
        int $pageSize
    ): array {
        $query = self::query()
            ->with('milestone:id,project_id,title')
            ->where('status', CodeMartV1Constants::TASK_STATUS_OPEN)
            ->whereNull('assigned_to')
            ->whereIn('milestone_id', self::marketplaceMilestoneIds())
            ->whereRaw('COALESCE(budget_allocation, 0) BETWEEN ? AND ?', [$minBudget, $maxBudget]);

        if ($skills !== []) {
            $query->where(function ($skillQuery) use ($skills) {
                foreach ($skills as $skill) {
                    $skillQuery->orWhereJsonContains('required_skills', $skill);
                }
            });
        }

        $total = (clone $query)->count();
        $tasks = $query->latest('created_at')
            ->forPage($page, $pageSize)
            ->get();

        return ['tasks' => $tasks, 'total' => $total];
    }

    /** Milestone ids whose project currently exposes tasks on the marketplace. */
    private static function marketplaceMilestoneIds(): \Closure
    {
        return static function ($subQuery): void {
            $subQuery->select('m.id')
                ->from(CodeMartV1TablesMaps::CODEMART_MILESTONES_TABLE . ' as m')
                ->join(CodeMartV1TablesMaps::CODEMART_PROJECTS_TABLE . ' as p', 'p.id', '=', 'm.project_id')
                ->whereIn('p.status', CodeMartV1Constants::PROJECT_MARKETPLACE_STATUSES);
        };
    }

    /** Milestone ids of projects the user manages (client or architect). */
    private static function managedMilestoneIds(int $userId): \Closure
    {
        return static function ($subQuery) use ($userId): void {
            $subQuery->select('m.id')
                ->from(CodeMartV1TablesMaps::CODEMART_MILESTONES_TABLE . ' as m')
                ->join(CodeMartV1TablesMaps::CODEMART_PROJECTS_TABLE . ' as p', 'p.id', '=', 'm.project_id')
                ->where(function ($owner) use ($userId): void {
                    $owner->where('p.client_id', $userId)->orWhere('p.architect_id', $userId);
                });
        };
    }

    /** Tasks visible to a user: managed projects or tasks assigned to the user. */
    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->where(function ($visible) use ($userId): void {
            $visible->where('assigned_to', $userId)
                ->orWhereIn('milestone_id', self::managedMilestoneIds($userId));
        });
    }

    /** Atomic marketplace claim: open, unassigned, and the project accepts work. */
    public static function acceptOpenTask(int $taskId, int $userId): bool
    {
        return self::query()
            ->whereKey($taskId)
            ->where('status', CodeMartV1Constants::TASK_STATUS_OPEN)
            ->whereNull('assigned_to')
            ->whereIn('milestone_id', self::marketplaceMilestoneIds())
            ->update([
                'assigned_to' => $userId,
                'status' => CodeMartV1Constants::TASK_STATUS_ASSIGNED,
                'assigned_at' => now(),
                'state_revision' => DB::raw('state_revision + 1'),
                'updated_at' => now(),
            ]) === 1;
    }

    /** Compare-and-set status change; false when the task is no longer in $fromStatus. */
    public static function compareAndSetStatus(int $taskId, string $fromStatus, string $toStatus, array $extra = []): bool
    {
        return self::query()
            ->whereKey($taskId)
            ->where('status', $fromStatus)
            ->update(array_merge($extra, [
                'status' => $toStatus,
                'state_revision' => DB::raw('state_revision + 1'),
                'updated_at' => now(),
            ])) === 1;
    }

    public static function assignedPage(int $userId, int $page, int $pageSize): array
    {
        $query = self::query()
            ->with('milestone:id,project_id,title')
            ->where('assigned_to', $userId)
            ->whereIn('status', [
                CodeMartV1Constants::TASK_STATUS_ASSIGNED,
                CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
                CodeMartV1Constants::TASK_STATUS_REVIEW,
                CodeMartV1Constants::TASK_STATUS_BLOCKED,
                CodeMartV1Constants::TASK_STATUS_COMPLETED,
            ])
            ->latest('updated_at');

        return self::paginateQuery($query, 'tasks', $page, $pageSize);
    }

    public static function forProjectQuery(int $projectId): Builder
    {
        return self::query()->whereIn('milestone_id', function ($subQuery) use ($projectId): void {
            $subQuery->select('id')
                ->from(CodeMartV1TablesMaps::CODEMART_MILESTONES_TABLE)
                ->where('project_id', $projectId);
        });
    }

    public static function unfinishedCountForProject(int $projectId): int
    {
        return self::forProjectQuery($projectId)
            ->whereNotIn('status', CodeMartV1Constants::TASK_TERMINAL_STATUSES)
            ->count();
    }

    public static function unfinishedCountForMilestone(int $milestoneId): int
    {
        return self::query()
            ->where('milestone_id', $milestoneId)
            ->whereNotIn('status', CodeMartV1Constants::TASK_TERMINAL_STATUSES)
            ->count();
    }

    public static function assigneeIdsForProject(int $projectId, array $statuses = []): array
    {
        $query = self::forProjectQuery($projectId)->whereNotNull('assigned_to');
        if ($statuses !== []) {
            $query->whereIn('status', $statuses);
        }

        return array_values(array_unique(array_map('intval', $query->pluck('assigned_to')->all())));
    }

    public static function projectHasAssignee(int $projectId, int $userId): bool
    {
        return self::forProjectQuery($projectId)->where('assigned_to', $userId)->exists();
    }

    public static function forProjectInStatuses(int $projectId, array $statuses): Collection
    {
        return self::forProjectQuery($projectId)->whereIn('status', $statuses)->get();
    }

    public function resolveProject(): ?CodeMartV1ProjectModel
    {
        $this->loadMissing('milestone.project');

        return $this->milestone?->project;
    }

    public static function filteredPage(array $filters, int $page, int $pageSize): array
    {
        $query = static::query()->with(['milestone', 'assignee']);

        if (array_key_exists('visible_to', $filters)) {
            $query->visibleTo((int) $filters['visible_to']);
        }
        if (array_key_exists('project_id', $filters)) {
            $query->whereIn('milestone_id', function ($subQuery) use ($filters): void {
                $subQuery->select('id')
                    ->from(CodeMartV1TablesMaps::CODEMART_MILESTONES_TABLE)
                    ->where('project_id', (int) $filters['project_id']);
            });
        }
        foreach (['milestone_id', 'status', 'priority', 'assigned_to'] as $field) {
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

        return self::paginateQuery(
            $query->orderBy('order')->orderByDesc('created_at'),
            'tasks',
            $page,
            $pageSize
        );
    }

    /**
     * Tasks reach the marketplace only when the project accepts work; on a
     * draft/proposal/funding project they stay pending until it opens.
     */
    public static function createForMilestone(int $milestoneId, array $attributes, bool $projectAcceptsWork): self
    {
        $nextOrder = ((int) static::query()->where('milestone_id', $milestoneId)->max('order')) + 1;
        $status = CodeMartV1Constants::TASK_STATUS_PENDING;
        if ($projectAcceptsWork) {
            $status = empty($attributes['assigned_to'])
                ? CodeMartV1Constants::TASK_STATUS_OPEN
                : CodeMartV1Constants::TASK_STATUS_ASSIGNED;
        }

        return static::query()->create(array_merge($attributes, [
            'milestone_id' => $milestoneId,
            'order' => $nextOrder,
            'status' => $status,
            'assigned_to' => $projectAcceptsWork ? ($attributes['assigned_to'] ?? null) : null,
            'assigned_at' => $projectAcceptsWork && !empty($attributes['assigned_to']) ? now() : null,
        ]));
    }

    public static function findDetailed(int $taskId): ?self
    {
        return static::query()->with([
            'milestone',
            'assignee',
            'submissions' => fn ($query) => $query->latest(),
            'submissions.reviews',
            'comments' => fn ($query) => $query->latest(),
            'comments.user',
        ])->find($taskId);
    }
}
