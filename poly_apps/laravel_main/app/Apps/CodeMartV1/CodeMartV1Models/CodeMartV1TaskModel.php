<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;

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

    public static function marketplacePage(
        array $skills,
        float $minBudget,
        float $maxBudget,
        int $page,
        int $pageSize
    ): array {
        $query = self::query()
            ->where('status', 'open')
            ->whereNull('assigned_to')
            ->whereBetween('budget_allocation', [$minBudget, $maxBudget]);

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

    public static function acceptOpenTask(int $taskId, int $userId): bool
    {
        return self::query()
            ->whereKey($taskId)
            ->where('status', 'open')
            ->whereNull('assigned_to')
            ->update([
                'assigned_to' => $userId,
                'status' => 'in_progress',
                'assigned_at' => now(),
                'updated_at' => now(),
            ]) === 1;
    }

    public static function assignedTasks(int $userId): Collection
    {
        return self::query()
            ->where('assigned_to', $userId)
            ->whereIn('status', ['in_progress', 'review', 'completed'])
            ->latest('updated_at')
            ->get();
    }

    public static function filteredPage(array $filters, int $page, int $pageSize): array
    {
        $query = static::query()->with(['milestone', 'assignee']);

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

    public static function createForMilestone(int $milestoneId, array $attributes): self
    {
        $nextOrder = ((int) static::query()->where('milestone_id', $milestoneId)->max('order')) + 1;

        return static::query()->create(array_merge($attributes, [
            'milestone_id' => $milestoneId,
            'order' => $nextOrder,
            'status' => 'pending',
        ]));
    }

    public static function findDetailed(int $taskId): ?self
    {
        return static::query()->with([
            'milestone',
            'assignee',
            'submissions' => fn ($query) => $query->latest(),
            'comments' => fn ($query) => $query->latest(),
        ])->find($taskId);
    }
}
