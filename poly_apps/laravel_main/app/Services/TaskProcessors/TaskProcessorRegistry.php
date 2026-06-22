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
     * Process task result using registered processors.
     *
     * @param GlobalTask $task
     * @param array $result
     * @param bool $isDemoMode
     * @return int|null Number of items the matching processor stored, or null
     *                  when NO processor handled the task (so the caller can tell
     *                  "nobody owns this task type" apart from "owned but stored
     *                  0 items" — only the latter is a result-trust failure).
     */
    public function process(GlobalTask $task, array $result, bool $isDemoMode): ?int
    {
        foreach ($this->processors as $processor) {
            if ($processor->canProcess($task)) {
                return $processor->processResult($task, $result, $isDemoMode);
            }
        }

        return null;
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
