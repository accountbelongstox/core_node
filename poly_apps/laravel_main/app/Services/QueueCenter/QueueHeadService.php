<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;

class QueueHeadService
{
    private const TRANSACTION_ATTEMPTS = 3;

    /**
     * Move a pending task to the physical queue head.
     *
     * queue_position is a monotonic per-task-type ticket.
     *
     * @return array{status:string,task:?GlobalTask,queue_position:int}
     */
    public function moveTaskToHead(string $taskId): array
    {
        $status = GlobalTask::status('pending');
        $result = GlobalTask::movePendingToQueueHead(
            $taskId,
            $status,
            self::TRANSACTION_ATTEMPTS
        );
        $task = $result['task'];

        if ($result['status'] === 'moved_to_head' && $task !== null) {
            (new DiffIdPageCatalog())->moveToHead(
                'global_tasks:queue:' . (string) $task->task_type,
                (string) $task->task_id
            );
            app(QueueSliceDiffService::class)->markChanged((string) $task->task_type);
        }

        return [
            'status' => $result['status'],
            'task' => $task,
            'queue_position' => (int) $result['queue_position'],
        ];
    }
}
