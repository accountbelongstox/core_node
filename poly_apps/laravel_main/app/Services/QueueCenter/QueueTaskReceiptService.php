<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Schema;

class QueueTaskReceiptService
{
    public function __construct(private QueueWorkerPresenceService $workerPresence)
    {
    }

    public function receipts(array $taskIds): array
    {
        $limit = max(1, (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128));
        $ids = array_slice(array_values(array_unique(array_filter(
            array_map(static fn ($value): string => trim((string) $value), $taskIds),
            static fn (string $value): bool => $value !== ''
        ))), 0, $limit);
        $workers = $this->workerPresence->snapshot();
        if (!Schema::hasTable((new GlobalTask())->getTable())) {
            return [
                'receipts' => array_map(static fn (string $taskId): array => [
                    'task_id' => $taskId,
                    'task_type' => null,
                    'stage' => QueueCenterContract::deliveryReceiptStage('waiting'),
                    'task_status' => null,
                    'priority' => null,
                    'worker' => null,
                    'updated_at' => null,
                ], $ids),
                'workers' => $workers,
            ];
        }
        $tasks = GlobalTask::query()
            ->whereIn('task_id', $ids)
            ->get(['task_id', 'task_type', 'status', 'priority', 'assigned_to', 'updated_at'])
            ->keyBy('task_id');
        $workersById = [];
        foreach ($workers as $worker) {
            $workersById[(string) $worker['id']] = $worker;
        }
        $receipts = [];
        foreach ($ids as $taskId) {
            $task = $tasks->get($taskId);
            if ($task === null) {
                $receipts[] = [
                    'task_id' => $taskId,
                    'task_type' => null,
                    'stage' => QueueCenterContract::deliveryReceiptStage('waiting'),
                    'task_status' => null,
                    'priority' => null,
                    'worker' => null,
                    'updated_at' => null,
                ];
                continue;
            }
            $worker = $task->assigned_to !== null
                ? ($workersById[(string) $task->assigned_to] ?? null)
                : null;
            $receipts[] = [
                'task_id' => (string) $task->task_id,
                'task_type' => (string) $task->task_type,
                'stage' => $this->stage((string) $task->status, $worker),
                'task_status' => (string) $task->status,
                'priority' => (int) $task->priority,
                'worker' => $worker,
                'updated_at' => $task->updated_at?->toIso8601String(),
            ];
        }

        return ['receipts' => $receipts, 'workers' => $workers];
    }

    private function stage(string $status, ?array $worker): string
    {
        if ($status === GlobalTask::status('completed') || $status === GlobalTask::status('completed_demo')) {
            return QueueCenterContract::deliveryReceiptStage('completed');
        }
        if ($status === GlobalTask::status('failed') || $status === GlobalTask::status('cancelled')) {
            return QueueCenterContract::deliveryReceiptStage('failed');
        }
        if (in_array($status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)
            && ($worker['online'] ?? false) === true
        ) {
            return QueueCenterContract::deliveryReceiptStage('worker_received');
        }
        return QueueCenterContract::deliveryReceiptStage('laravel_received');
    }
}
