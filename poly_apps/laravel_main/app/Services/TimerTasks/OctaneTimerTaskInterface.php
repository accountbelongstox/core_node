<?php

namespace App\Services\TimerTasks;

/**
 * Octane Timer Task Interface
 *
 * All timer tasks must implement this interface.
 * Tasks are auto-discovered and registered by OctaneTimerServiceProvider.
 */
interface OctaneTimerTaskInterface
{
    public const EXECUTION_INLINE = 'inline';
    public const EXECUTION_BACKGROUND = 'background';

    /**
     * Get task name (unique identifier)
     *
     * @return string
     */
    public function getName(): string;

    /**
     * Get task interval in seconds
     * 0 = run on every tick (1 second)
     * N = run every N seconds
     *
     * @return int
     */
    public function getInterval(): int;

    /**
     * Execute task logic
     * This method is called by the timer when interval is reached
     *
     * @return void
     */
    public function exec(): void;

    /**
     * Check if task should be enabled
     * Return false to disable task
     *
     * @return bool
     */
    public function isEnabled(): bool;

    /**
     * Select whether the task may run on the heartbeat or must be dispatched
     * to an Octane task worker. Non-Swoole scheduler processes execute the
     * background class locally because they are already isolated from HTTP
     * workers.
     */
    public function getExecutionMode(): string;
}
