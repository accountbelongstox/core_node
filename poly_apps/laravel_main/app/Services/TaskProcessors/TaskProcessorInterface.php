<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;

/**
 * Task Processor Interface
 *
 * All task processors must implement this interface to handle specific task types.
 * This allows extensible task processing without modifying core TaskManagerService.
 */
interface TaskProcessorInterface
{
    /**
     * Check if this processor can handle the given task
     *
     * @param GlobalTask $task
     * @return bool
     */
    public function canProcess(GlobalTask $task): bool;

    /**
     * Process the task result
     *
     * @param GlobalTask $task
     * @param array $result Result data from worker
     * @param bool $isDemoMode Whether this is demo mode
     * @return void
     */
    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): void;

    /**
     * Get processor priority (higher = process first)
     *
     * @return int
     */
    public function getPriority(): int;
}
