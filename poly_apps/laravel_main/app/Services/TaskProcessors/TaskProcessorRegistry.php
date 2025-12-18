<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;

/**
 * Task Processor Registry
 *
 * Central registry for all task processors. Allows dynamic registration
 * and automatic routing of tasks to appropriate processors.
 */
class TaskProcessorRegistry
{
    /** @var TaskProcessorInterface[] */
    protected array $processors = [];

    /**
     * Register a task processor
     *
     * @param TaskProcessorInterface $processor
     * @return void
     */
    public function register(TaskProcessorInterface $processor): void
    {
        $this->processors[] = $processor;

        // Sort by priority (descending)
        usort($this->processors, function ($a, $b) {
            return $b->getPriority() <=> $a->getPriority();
        });
    }

    /**
     * Process task result using registered processors
     *
     * @param GlobalTask $task
     * @param array $result
     * @param bool $isDemoMode
     * @return bool Whether a processor handled the task
     */
    public function process(GlobalTask $task, array $result, bool $isDemoMode): bool
    {
        foreach ($this->processors as $processor) {
            if ($processor->canProcess($task)) {
                $processor->processResult($task, $result, $isDemoMode);
                return true;
            }
        }

        return false;
    }

    /**
     * Get all registered processors
     *
     * @return TaskProcessorInterface[]
     */
    public function getProcessors(): array
    {
        return $this->processors;
    }
}
