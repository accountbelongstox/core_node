<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

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
        if (!GlobalTask::tableExists()) {
            return [
                'receipts' => array_map(static fn (string $taskId): array => [
                    'task_id' => $taskId,
                    'task_type' => null,
                    'stage' => QueueCenterContract::deliveryReceiptStage('waiting'),
                    'task_status' => null,
                    'queue_position' => null,
                    'priority' => null,
                    'worker' => null,
                    'updated_at' => null,
                ], $ids),
                'workers' => $workers,
            ];
        }
        $tasks = GlobalTask::receiptTasks($ids);
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
                    'queue_position' => null,
                    'priority' => null,
                    'worker' => null,
                    'updated_at' => null,
                ];
                continue;
            }
            $worker = $task->assigned_to !== null
                ? ($workersById[(string) $task->assigned_to] ?? null)
                : null;
            $receipt = [
                'task_id' => (string) $task->task_id,
                'task_type' => (string) $task->task_type,
                'stage' => $this->stage((string) $task->status, $worker),
                'task_status' => (string) $task->status,
                'queue_position' => (int) $task->queue_position,
                'progress' => (float) $task->progress,
                'estimated_wait_seconds' => $this->estimatedWaitSeconds($task, $worker),
                'worker' => $worker,
                'updated_at' => $task->updated_at?->toIso8601String(),
            ];
            if (!QueueCenterService::isSupportedQueue((string) $task->task_type)) {
                $receipt['priority'] = (int) $task->priority;
            }
            $receipts[] = $receipt;
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
        if ($status === GlobalTask::status('processing') && ($worker['online'] ?? false) === true) {
            return QueueCenterContract::deliveryReceiptStage('processing');
        }
        if (in_array($status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)
            && ($worker['online'] ?? false) === true
        ) {
            return QueueCenterContract::deliveryReceiptStage('worker_received');
        }
        return QueueCenterContract::deliveryReceiptStage('laravel_received');
    }

    private function estimatedWaitSeconds(GlobalTask $task, ?array $worker): ?int
    {
        $status = (string) $task->status;
        if (in_array($status, [GlobalTask::status('completed'), GlobalTask::status('completed_demo')], true)) {
            return 0;
        }
        if (!in_array($status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)
            || ($worker['online'] ?? false) !== true
            || $task->assigned_at === null
        ) {
            return null;
        }

        $elapsed = max(1, $task->assigned_at->diffInSeconds(now()));
        $progress = max(0.0, min(100.0, (float) $task->progress));
        $timeoutRemaining = max(1, (int) $task->timeout_seconds - $elapsed);
        if ($progress <= 0.0) {
            return $timeoutRemaining;
        }

        $progressEstimate = (int) ceil($elapsed * (100.0 - $progress) / $progress);
        return max(1, min($timeoutRemaining, $progressEstimate));
    }
}
