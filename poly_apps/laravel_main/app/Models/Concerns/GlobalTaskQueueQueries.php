<?php

namespace App\Models\Concerns;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Query\Expression;

trait GlobalTaskQueueQueries
{
    public static function tableExists(): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function findNewestLiveByGroupKey(
        string $taskType,
        string $groupKey,
        array $liveStatuses
    ): ?GlobalTask {
        return self::query()
            ->where('task_type', $taskType)
            ->where('group_key', $groupKey)
            ->whereIn('status', $liveStatuses)
            ->latest('id')
            ->first();
    }

    public static function statusCountsForTaskType(string $taskType): Collection
    {
        return self::query()
            ->where('task_type', $taskType)
            ->groupBy('status')
            ->selectRaw('status, count(*) as aggregate')
            ->pluck('aggregate', 'status');
    }

    public static function liveCountsByTypeAndStatus(array $statuses): EloquentCollection
    {
        return self::query()
            ->whereIn('status', $statuses)
            ->groupBy('task_type', 'status')
            ->selectRaw('task_type, status, count(*) as total')
            ->get();
    }

    public static function liveCountsByCapabilityLaneAndStatus(array $statuses): EloquentCollection
    {
        return self::query()
            ->whereIn('status', $statuses)
            ->groupBy('capability', 'execution_type', 'status')
            ->selectRaw('capability, execution_type, status, count(*) as total')
            ->get();
    }

    public static function incrementPriorityForIds(array $ids, int $increment): int
    {
        return self::query()
            ->whereIn('id', $ids)
            ->update(['priority' => new Expression('priority + ' . $increment)]);
    }

    public static function liveTaskCount(
        string $appName,
        array $taskTypes,
        array $statuses,
        array $payloadFilters = []
    ): int {
        $query = self::query()
            ->where('app_name', $appName)
            ->whereIn('task_type', $taskTypes)
            ->whereIn('status', $statuses);

        foreach ($payloadFilters as $field => $value) {
            $query->where('payload->' . $field, $value);
        }

        return (int) $query->count();
    }

    public static function hasBacklogAtLeast(string $taskType, array $statuses, int $target): bool
    {
        return self::query()
            ->where('task_type', $taskType)
            ->whereIn('status', $statuses)
            ->orderBy('id')
            ->offset(max(0, $target - 1))
            ->limit(1)
            ->exists();
    }

    public static function claimedCountsByWorker(array $statuses): Collection
    {
        return self::query()
            ->whereIn('status', $statuses)
            ->whereNotNull('assigned_to')
            ->groupBy('assigned_to')
            ->selectRaw('assigned_to, count(*) as total')
            ->pluck('total', 'assigned_to');
    }

    public static function queuePageTaskIds(
        string $taskType,
        array $liveStatuses,
        int $page,
        int $limit
    ): array {
        $query = self::query()->where('task_type', $taskType);
        $bindings = implode(', ', array_fill(0, count($liveStatuses), '?'));
        $total = (int) (clone $query)->count();
        $query->orderByRaw("CASE WHEN status IN ({$bindings}) THEN 0 ELSE 1 END", $liveStatuses);
        $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));
        $taskIds = $query
            ->orderBy('created_at')
            ->orderBy('id')
            ->forPage($page, $limit)
            ->pluck('task_id')
            ->all();

        return ['total' => $total, 'task_ids' => $taskIds];
    }

    public static function tasksByTaskIds(array $taskIds, ?string $taskType = null, ?array $columns = null): array
    {
        $positions = array_flip(array_map('strval', $taskIds));
        $query = self::query()->whereIn('task_id', $taskIds);

        if ($taskType !== null) {
            $query->where('task_type', $taskType);
        }

        return $query
            ->get($columns ?? ['*'])
            ->sortBy(static fn (GlobalTask $task): int => $positions[(string) $task->task_id] ?? PHP_INT_MAX)
            ->values()
            ->all();
    }

    public static function liveQueuePage(
        string $taskType,
        array $liveStatuses,
        int $page,
        int $limit,
        ?string $language,
        array $columns
    ): array {
        $query = self::query()
            ->where('task_type', $taskType)
            ->whereIn('status', $liveStatuses);

        if ($language !== null && $language !== '') {
            $query->where('payload->language', $language);
        }

        $total = (int) (clone $query)->count();
        $orderedQuery = clone $query;
        $orderedQuery->orderByDesc(QueueCenterContract::taskOrdering($taskType));
        $tasks = $orderedQuery
            ->orderBy('created_at')
            ->orderBy('id')
            ->forPage($page, $limit)
            ->get($columns);
        $languageCounts = (clone $query)
            ->selectRaw("lower(trim(payload->>'language')) as language_key, count(*) as aggregate")
            ->groupByRaw("lower(trim(payload->>'language'))")
            ->pluck('aggregate', 'language_key');

        return [
            'total' => $total,
            'tasks' => $tasks,
            'language_counts' => $languageCounts,
        ];
    }

    public static function queueRowsAfterId(
        string $taskType,
        int $cursor,
        int $limit
    ): EloquentCollection {
        return self::query()
            ->where('task_type', $taskType)
            ->where('id', '>', $cursor)
            ->orderBy('id')
            ->limit($limit)
            ->get(['id', 'task_id', 'status', 'queue_position']);
    }

    public static function receiptTasks(array $taskIds): EloquentCollection
    {
        return self::query()
            ->whereIn('task_id', $taskIds)
            ->get([
                'task_id',
                'task_type',
                'status',
                'queue_position',
                'priority',
                'assigned_to',
                'updated_at',
            ])
            ->keyBy('task_id');
    }

    public static function pendingHeadTaskIds(
        string $taskType,
        int $limit
    ): array {
        $query = self::query()->pending()
            ->where('task_type', $taskType);
        $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));

        return $query
            ->orderBy('created_at')
            ->orderBy('id')
            ->limit($limit)
            ->pluck('task_id')
            ->map(static fn ($taskId): string => (string) $taskId)
            ->values()
            ->all();
    }

    public static function pendingHeadTask(string $taskType): ?GlobalTask
    {
        $query = self::query()->pending()->where('task_type', $taskType);
        $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));

        return $query
            ->orderBy('created_at')
            ->orderBy('id')
            ->first();
    }

    public static function movePendingToQueueHead(
        string $taskId,
        string $pendingStatus,
        int $attempts
    ): array {
        $model = new static();
        $task = null;
        $queuePosition = 0;

        $status = $model->getConnection()->transaction(
            static function () use ($taskId, $pendingStatus, &$task, &$queuePosition): string {
                $task = self::query()
                    ->where('task_id', $taskId)
                    ->lockForUpdate()
                    ->first();

                if ($task === null) {
                    return 'not_found';
                }

                if ((string) $task->status !== $pendingStatus) {
                    return 'not_queued';
                }

                $taskType = (string) $task->task_type;
                $task->getConnection()->select(
                    'SELECT pg_advisory_xact_lock(hashtext(?))',
                    ['queue-head:' . $taskType]
                );
                $queuePosition = ((int) self::query()
                    ->where('task_type', $taskType)
                    ->max('queue_position')) + 1;
                $task->queue_position = $queuePosition;
                $task->save();

                return 'moved_to_head';
            },
            $attempts
        );

        return [
            'status' => $status,
            'task' => $task,
            'queue_position' => $queuePosition,
        ];
    }

    public static function purgeTerminalBatches(array $batches, int $limit): int
    {
        $purged = 0;

        foreach ($batches as $batch) {
            $remaining = $limit - $purged;
            if ($remaining <= 0) {
                break;
            }

            $ids = self::query()
                ->whereIn('status', $batch['statuses'])
                ->where('updated_at', '<', $batch['before'])
                ->limit($remaining)
                ->pluck('id');

            if ($ids->isNotEmpty()) {
                $purged += self::query()->whereIn('id', $ids)->delete();
            }
        }

        return $purged;
    }

    public static function retagPendingTasks(
        array $taskTypes,
        array $fromExecutionTypes,
        string $toExecutionType,
        ?string $capability = null
    ): int {
        $updates = ['execution_type' => $toExecutionType];
        if ($capability !== null) {
            $updates['capability'] = $capability;
        }

        return self::query()
            ->whereIn('task_type', $taskTypes)
            ->whereIn('execution_type', $fromExecutionTypes)
            ->where('status', self::status('pending'))
            ->update($updates);
    }

    public static function expireNeverAssignedPending($cutoff, int $limit): int
    {
        $rows = self::query()
            ->where('status', self::status('pending'))
            ->whereNull('assigned_to')
            ->whereNull('assigned_at')
            ->where('created_at', '<', $cutoff)
            ->limit($limit)
            ->get(['id', 'execution_type']);
        $expired = 0;

        foreach ($rows as $task) {
            $expired += self::query()
                ->where('id', $task->id)
                ->where('status', self::status('pending'))
                ->update([
                    'status' => self::status('failed'),
                    'error' => 'expired: no worker registered for lane ' . $task->execution_type,
                    'updated_at' => now(),
                ]);
        }

        return $expired;
    }

    public static function createTaskRecord(array $attributes): self
    {
        return self::query()->create($attributes);
    }

    public static function lockByTaskId(string $taskId): ?self
    {
        return self::query()->where('task_id', $taskId)->lockForUpdate()->first();
    }

    public static function assignedWorkerId(string $taskId): ?string
    {
        $workerId = self::query()->where('task_id', $taskId)->value('assigned_to');

        return is_string($workerId) && $workerId !== '' ? $workerId : null;
    }

    public static function pendingClaimCandidatesForTaskType(
        string $taskType,
        int $limit
    ): EloquentCollection {
        $query = self::query()
            ->where('status', self::status('pending'))
            ->where('task_type', $taskType);
        $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));

        return $query
            ->oldest('created_at')
            ->orderBy('id')
            ->limit(min(32, $limit + 8))
            ->lockForUpdate()
            ->get();
    }

    public static function pendingClaimCandidatesForExecutionType(
        string $executionType,
        int $limit
    ): EloquentCollection {
        $priorityNeutralTaskTypes = QueueCenterContract::queuePositionOrderedTaskTypes();
        $placeholders = implode(',', array_fill(0, max(1, count($priorityNeutralTaskTypes)), '?'));
        return self::query()
            ->where('status', self::status('pending'))
            ->where('execution_type', $executionType)
            ->orderByDesc('queue_position')
            ->orderByRaw(
                "CASE WHEN task_type IN ({$placeholders}) THEN 0 ELSE priority END DESC",
                $priorityNeutralTaskTypes === [] ? [''] : array_values($priorityNeutralTaskTypes)
            )
            ->oldest('created_at')
            ->limit($limit)
            ->lockForUpdate()
            ->get();
    }

    public static function pendingSignals(
        string $taskType,
        int $minimumPriority,
        string $fastExecutionType,
        array $capabilities
    ): array {
        $capabilityClause = 'capability IS NULL';
        $bindings = [$minimumPriority, $fastExecutionType];

        if ($capabilities !== []) {
            $placeholders = implode(',', array_fill(0, count($capabilities), '?'));
            $capabilityClause .= " OR capability IN ({$placeholders})";
            $bindings = array_merge($bindings, $capabilities);
        }

        $row = self::query()
            ->where('status', self::status('pending'))
            ->where('task_type', $taskType)
            ->selectRaw(
                'SUM(CASE WHEN priority >= ? THEN 1 ELSE 0 END) AS pending_urgent, '
                    . 'SUM(CASE WHEN execution_type = ? AND (' . $capabilityClause . ') THEN 1 ELSE 0 END) AS pending_fast',
                $bindings
            )
            ->first();

        return [
            'pending_urgent' => (int) ($row->pending_urgent ?? 0),
            'pending_fast' => (int) ($row->pending_fast ?? 0),
        ];
    }

    public static function countUrgentPendingForExecutionTypes(array $executionTypes, int $minimumPriority): int
    {
        return self::query()
            ->where('status', self::status('pending'))
            ->whereIn('execution_type', $executionTypes)
            ->where('priority', '>=', $minimumPriority)
            ->count();
    }

    public static function countFastPendingForCapabilities(string $executionType, array $capabilities): int
    {
        return self::query()
            ->where('status', self::status('pending'))
            ->where('execution_type', $executionType)
            ->where(function ($query) use ($capabilities): void {
                $query->whereNull('capability');
                if ($capabilities !== []) {
                    $query->orWhereIn('capability', $capabilities);
                }
            })
            ->count();
    }

    public static function timedOutTaskIds(): array
    {
        return self::query()
            ->whereIn('status', [self::status('assigned'), self::status('processing')])
            ->whereNotNull('timeout_at')
            ->where('timeout_at', '<=', now())
            ->pluck('task_id')
            ->all();
    }

    public static function lockedTasksHeldByWorker(string $workerId): EloquentCollection
    {
        return self::query()
            ->where('assigned_to', $workerId)
            ->whereIn('status', [self::status('assigned'), self::status('processing')])
            ->lockForUpdate()
            ->get();
    }

    public static function taskListPage(array $filters, int $limit, int $offset): array
    {
        $query = self::query();

        foreach (['status', 'app_name', 'execution_type'] as $column) {
            if (isset($filters[$column]) && $filters[$column] !== '') {
                $query->where($column, $filters[$column]);
            }
        }

        return [
            'total' => $query->count(),
            'tasks' => $query
                ->select([
                    'task_id', 'app_name', 'task_type', 'execution_type', 'status',
                    'progress', 'assigned_to', 'created_at', 'capability',
                    'queue_position', 'priority', 'is_fast_tier',
                ])
                ->latest('created_at')
                ->skip(max(0, $offset))
                ->take(max(1, $limit))
                ->get(),
        ];
    }

    public static function statusTotals(): Collection
    {
        return self::query()
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');
    }

    public static function terminalHistory(int $cursorId, string $taskType, int $limit): EloquentCollection
    {
        $query = self::query()->whereIn('status', self::statuses('terminal'));

        if ($cursorId > 0) {
            $query->where('id', '<', $cursorId);
        }

        if ($taskType !== '' && $taskType !== 'all') {
            self::applyTerminalTaskTypeFilter($query, $taskType);
        }

        return $query
            ->select([
                'id', 'task_id', 'app_name', 'task_type', 'execution_type',
                'capability', 'status', 'assigned_to', 'payload', 'result',
                'error', 'retry_count', 'created_at', 'updated_at', 'completed_at',
            ])
            ->latest('id')
            ->limit($limit)
            ->get();
    }

    protected static function applyTerminalTaskTypeFilter($query, string $taskType): void
    {
        $filter = QueueCenterContract::taskHistoryFilter($taskType);
        $exact = $filter['exact'];
        $tokenRules = $filter['token_rules'];
        if ($tokenRules === []) {
            $query->whereIn('task_type', $exact);
            return;
        }

        $query->where(function ($bucketQuery) use ($exact, $tokenRules): void {
            $bucketQuery->whereIn('task_type', $exact);
            foreach ($tokenRules as $rule) {
                $allTokens = array_values($rule['all'] ?? []);
                $anyTokens = array_values($rule['any'] ?? []);
                $bucketQuery->orWhere(function ($ruleQuery) use ($allTokens, $anyTokens): void {
                    foreach ($allTokens as $token) {
                        $ruleQuery->whereLike('task_type', '%' . $token . '%', caseSensitive: false);
                    }
                    if ($anyTokens !== []) {
                        $ruleQuery->where(function ($anyQuery) use ($anyTokens): void {
                            foreach ($anyTokens as $index => $token) {
                                if ($index === 0) {
                                    $anyQuery->whereLike('task_type', '%' . $token . '%', caseSensitive: false);
                                } else {
                                    $anyQuery->orWhereLike('task_type', '%' . $token . '%', caseSensitive: false);
                                }
                            }
                        });
                    }
                });
            }
        });
    }

    public static function filteredStatusCounts(
        string $appName,
        string $taskType,
        ?string $capability = null,
        ?string $excludedCapability = null
    ): Collection {
        $query = self::query()->where('app_name', $appName)->where('task_type', $taskType);

        if ($capability !== null) {
            $query->where('capability', $capability);
        }
        if ($excludedCapability !== null) {
            $query->where(function ($filter) use ($excludedCapability): void {
                $filter->whereNull('capability')->orWhere('capability', '!=', $excludedCapability);
            });
        }

        return $query->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status');
    }

    public static function activePayloadSamples(
        string $appName,
        string $taskType,
        int $limit,
        ?string $capability = null,
        ?string $excludedCapability = null
    ): EloquentCollection {
        $query = self::query()
            ->where('app_name', $appName)
            ->where('task_type', $taskType)
            ->whereIn('status', [self::status('pending'), self::status('assigned'), self::status('processing')]);
        $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));
        if ($capability !== null) {
            $query->where('capability', $capability);
        }
        if ($excludedCapability !== null) {
            $query->where(function ($filter) use ($excludedCapability): void {
                $filter->whereNull('capability')->orWhere('capability', '!=', $excludedCapability);
            });
        }

        return $query->orderBy('created_at')->orderBy('id')->limit($limit)->get(['payload']);
    }

    public static function pendingPayloadTasks(string $appName, string $taskType, string $language): EloquentCollection
    {
        return self::query()
            ->where('app_name', $appName)
            ->where('task_type', $taskType)
            ->where('status', self::status('pending'))
            ->where('payload->language', $language)
            ->get(['task_id', 'payload', 'priority']);
    }

    public static function filteredPageForAppType(
        string $appName,
        string $taskType,
        array $statuses,
        int $offset,
        int $limit,
        array $columns = ['*'],
        bool $newestFirst = false
    ): array {
        $query = self::query()
            ->where('app_name', $appName)
            ->where('task_type', $taskType);

        if ($statuses !== []) {
            $query->whereIn('status', $statuses);
        }

        $total = (clone $query)->count();
        if ($newestFirst) {
            $query->orderByDesc('id');
        } else {
            $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));
            $query->orderBy('created_at')->orderBy('id');
        }

        return [
            'total' => $total,
            'rows' => $query->offset($offset)->limit($limit)->get($columns),
        ];
    }

    public static function findForAppTypeByTaskId(string $appName, string $taskType, string $taskId): ?self
    {
        return self::query()
            ->where('app_name', $appName)
            ->where('task_type', $taskType)
            ->where('task_id', $taskId)
            ->first();
    }

    public static function findForAppByTaskId(string $appName, string $taskId): ?self
    {
        return self::query()
            ->where('app_name', $appName)
            ->where('task_id', $taskId)
            ->first();
    }

    public static function recentForApp(string $appName, int $limit): EloquentCollection
    {
        return self::query()
            ->where('app_name', $appName)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    public static function recentForTaskType(string $taskType, int $limit, array $columns = ['*']): EloquentCollection
    {
        return self::query()
            ->where('task_type', $taskType)
            ->orderByDesc('id')
            ->limit($limit)
            ->get($columns);
    }

    public static function tasksForAppByIds(string $appName, array $taskIds): EloquentCollection
    {
        return self::query()
            ->where('app_name', $appName)
            ->whereIn('task_id', $taskIds)
            ->get();
    }

    public static function deleteForAppByIds(string $appName, array $taskIds): int
    {
        return self::query()
            ->where('app_name', $appName)
            ->whereIn('task_id', $taskIds)
            ->delete();
    }

    public static function allForApp(string $appName): EloquentCollection
    {
        return self::query()->where('app_name', $appName)->orderBy('created_at')->get();
    }

    public static function upsertTaskRecord(string $taskId, array $attributes): self
    {
        return self::query()->updateOrCreate(['task_id' => $taskId], $attributes);
    }

    public static function activeTaskExists(string $taskId, array $statuses): bool
    {
        return self::query()->where('task_id', $taskId)->whereIn('status', $statuses)->exists();
    }

    public static function assistQueuePage(
        string $taskType,
        string $capabilityMode,
        array $statuses,
        bool $leasedOnly,
        string $search,
        int $start,
        int $limit
    ): array {
        $query = self::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType);

        if ($capabilityMode === 'include_ai_translate') {
            $query->where('capability', self::capability('ai_translate'));
        } elseif ($capabilityMode === 'exclude_ai_translate') {
            $query->where(function ($capabilityQuery): void {
                $capabilityQuery->whereNull('capability')
                    ->orWhere('capability', '!=', self::capability('ai_translate'));
            });
        }
        if ($leasedOnly) {
            $query->where('status', self::status('assigned'))->whereNotNull('assigned_to');
        } elseif ($statuses !== []) {
            $query->whereIn('status', $statuses);
        }
        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($searchQuery) use ($like): void {
                $searchQuery->whereLike('task_id', $like, caseSensitive: false)
                    ->orWhereLike('assigned_to', $like, caseSensitive: false)
                    ->orWhereRaw('CAST(payload AS TEXT) ILIKE ?', [$like]);
            });
        }

        $total = (clone $query)->count();
        $query->orderByDesc(QueueCenterContract::taskOrdering($taskType));

        return [
            'total' => $total,
            'rows' => $query->orderBy('created_at')->orderBy('id')->offset($start)->limit($limit)->get([
                'id', 'task_id', 'task_type', 'status', 'queue_position', 'priority', 'payload',
                'assigned_to', 'retry_count', 'created_at', 'updated_at',
            ]),
        ];
    }

    public static function pendingPayloadTasksForPair(
        string $appName,
        string $taskType,
        string $language,
        string $targetLanguage
    ): EloquentCollection {
        return self::query()
            ->where('app_name', $appName)
            ->where('task_type', $taskType)
            ->where('status', self::status('pending'))
            ->where('payload->language', $language)
            ->where('payload->target_language', $targetLanguage)
            ->get(['task_id', 'payload']);
    }

    public static function raisePendingPriority(string $taskId, int $priority): int
    {
        return self::query()
            ->where('task_id', $taskId)
            ->where('status', self::status('pending'))
            ->where('priority', '<', $priority)
            ->update(['priority' => $priority]);
    }

    public static function ageablePriorityIds($cutoff, int $maximumPriority, int $limit): array
    {
        $queuePositionTaskTypes = QueueCenterContract::queuePositionOrderedTaskTypes();

        return self::query()->pending()
            ->when(
                $queuePositionTaskTypes !== [],
                static fn ($query) => $query->whereNotIn('task_type', $queuePositionTaskTypes)
            )
            ->where('priority', '<=', $maximumPriority)
            ->where('created_at', '<', $cutoff)
            ->orderBy('created_at')
            ->limit($limit)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    public static function escalatePendingPriority(
        string $taskId,
        int $frontPriority,
        int $repeatStep,
        int $repeatCap
    ): int {
        return self::query()
            ->where('task_id', $taskId)
            ->where('status', self::status('pending'))
            ->update([
                'priority' => self::query()->getModel()->getConnection()->raw(
                    'CASE WHEN priority < ' . $frontPriority
                    . ' THEN ' . $frontPriority
                    . ' ELSE LEAST(priority + ' . $repeatStep . ', ' . $repeatCap . ') END'
                ),
            ]);
    }
}
