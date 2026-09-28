<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

/**
 * Shared task-type matcher for Laravel result write-back processors.
 *
 * Subclasses declare central task roles only. Wire keys are resolved from
 * config/queue_center_contract.json, so processors cannot create another task
 * vocabulary. Result persistence remains domain-specific in processResult().
 */
abstract class AbstractTaskProcessor implements TaskProcessorInterface
{
    /** @return array<int,string> Central task keys handled by this processor. */
    abstract protected function taskTypeRoles(): array;

    protected function appName(): ?string
    {
        return 'AppQyV1';
    }

    final public function canProcess(GlobalTask $task): bool
    {
        $appName = $this->appName();
        if ($appName !== null && $task->app_name !== $appName) {
            return false;
        }

        $taskTypes = array_values(array_filter(array_map(
            static fn (string $role): ?string => QueueCenterContract::taskTypeKey($role),
            $this->taskTypeRoles()
        )));
        return in_array($task->task_type, $taskTypes, true);
    }

    public function getPriority(): int
    {
        return 10;
    }
}
