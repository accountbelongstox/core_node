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
     * Process the task result.
     *
     * Returns the number of canonical items actually persisted by the write-back
     * (e.g. dictionary rows updated, records stored). The result-trust layer in
     * TaskManagerService::submitResult uses this count: a "completed" worker
     * result whose write-back stored 0 items is downgraded to 'failed' so an
     * empty/partial success cannot masquerade as a real one.
     *
     * @param GlobalTask $task
     * @param array $result Result data from worker
     * @param bool $isDemoMode Whether this is demo mode
     * @return int Number of items stored (>= 0)
     */
    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int;

    /**
     * Get processor priority (higher = process first)
     *
     * @return int
     */
    public function getPriority(): int;
}
