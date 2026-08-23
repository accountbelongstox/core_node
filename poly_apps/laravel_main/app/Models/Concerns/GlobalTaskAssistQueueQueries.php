<?php

namespace App\Models\Concerns;

use App\Support\QueueCenterContract;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

trait GlobalTaskAssistQueueQueries
{
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

