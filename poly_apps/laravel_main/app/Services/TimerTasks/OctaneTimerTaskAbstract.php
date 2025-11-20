<?php

namespace App\Services\TimerTasks;

use Illuminate\Support\Facades\Log;

/**
 * Abstract Timer Task Base Class
 *
 * Provides common functionality for timer tasks.
 * Extend this class to create new timer tasks.
 */
abstract class OctaneTimerTaskAbstract implements OctaneTimerTaskInterface
{
    /**
     * Task name (auto-generated from class name if not overridden)
     *
     * @return string
     */
    public function getName(): string
    {
        // Convert class name to snake_case
        $className = class_basename(static::class);
        $name = preg_replace('/(?<!^)[A-Z]/', '_$0', $className);
        return strtolower($name);
    }

    /**
     * Check if task should be enabled
     * Override to add custom enable/disable logic
     *
     * @return bool
     */
    public function isEnabled(): bool
    {
        return true;
    }

    /**
     * Log info message
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    protected function logInfo(string $message, array $context = []): void
    {
        Log::info($this->getName() . ': ' . $message, $context);
    }

    /**
     * Log debug message
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    protected function logDebug(string $message, array $context = []): void
    {
        Log::debug($this->getName() . ': ' . $message, $context);
    }

    /**
     * Log warning message
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    protected function logWarning(string $message, array $context = []): void
    {
        Log::warning($this->getName() . ': ' . $message, $context);
    }

    /**
     * Log error message
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    protected function logError(string $message, array $context = []): void
    {
        Log::error($this->getName() . ': ' . $message, $context);
    }
}
