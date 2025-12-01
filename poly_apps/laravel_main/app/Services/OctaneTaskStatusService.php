<?php

namespace App\Services;

use App\Services\TimerTasks\OctaneTimerTaskInterface;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Central Octane Task Status Service
 *
 * Provides unified interface for querying and monitoring all Octane timer tasks.
 * Used by sys:init for verification and debug interface for display.
 *
 * Now uses Laravel Schedule as single heartbeat center.
 */
class OctaneTaskStatusService
{
    private const TASKS_DIR = __DIR__ . '/TimerTasks';
    private const TASKS_NAMESPACE = 'App\\Services\\TimerTasks\\';

    /**
     * Get comprehensive status of all timer tasks
     */
    public function getAllTasksStatus(): array
    {
        $discoveredTasks = $this->discoverTaskClasses();
        $scheduleRunning = $this->isScheduleRunning();

        return [
            'summary' => [
                'total_discovered' => count($discoveredTasks),
                'total_enabled' => $this->countEnabled($discoveredTasks),
                'schedule_running' => $scheduleRunning,
                'heartbeat_method' => 'Laravel Schedule (1s)',
                'runner' => 'Octane::tick + schedule:run',
            ],
            'tasks' => $discoveredTasks,
            'heartbeat' => $this->getHeartbeatStatus(),
            'timestamp' => now()->toDateTimeString(),
        ];
    }

    /**
     * Check if Laravel Schedule is running (via heartbeat file)
     */
    private function isScheduleRunning(): bool
    {
        $heartbeat = $this->getHeartbeatStatus();
        return $heartbeat['exists'] && $heartbeat['status'] === 'alive';
    }

    /**
     * Count enabled tasks
     */
    private function countEnabled(array $tasks): int
    {
        return count(array_filter($tasks, fn($task) => $task['enabled'] ?? false));
    }

    /**
     * Discover all task classes in TimerTasks directory
     */
    private function discoverTaskClasses(): array
    {
        $tasks = [];

        if (!is_dir(self::TASKS_DIR)) {
            return $tasks;
        }

        $files = File::glob(self::TASKS_DIR . '/*.php');

        foreach ($files as $file) {
            $className = basename($file, '.php');

            if (in_array($className, ['OctaneTimerTaskInterface', 'OctaneTimerTaskAbstract'])) {
                continue;
            }

            $fullClassName = self::TASKS_NAMESPACE . $className;

            if (!class_exists($fullClassName)) {
                continue;
            }

            $implements = class_implements($fullClassName);
            if (!isset($implements[OctaneTimerTaskInterface::class])) {
                continue;
            }

            try {
                $instance = new $fullClassName();
                $tasks[] = [
                    'class' => $className,
                    'full_class' => $fullClassName,
                    'name' => $instance->getName(),
                    'interval' => $instance->getInterval(),
                    'enabled' => $instance->isEnabled(),
                    'status' => $instance->isEnabled() ? 'enabled' : 'disabled',
                    'schedule_method' => $this->getScheduleMethod($instance->getInterval()),
                    'file' => basename($file),
                ];
            } catch (\Throwable $e) {
                $tasks[] = [
                    'class' => $className,
                    'full_class' => $fullClassName,
                    'name' => null,
                    'interval' => null,
                    'enabled' => false,
                    'status' => 'error',
                    'error' => $e->getMessage(),
                    'file' => basename($file),
                ];
            }
        }

        return $tasks;
    }

    /**
     * Get Laravel Schedule method name for interval
     */
    private function getScheduleMethod(int $interval): string
    {
        return match ($interval) {
            1 => 'everySecond()',
            2 => 'everyTwoSeconds()',
            5 => 'everyFiveSeconds()',
            10 => 'everyTenSeconds()',
            15 => 'everyFifteenSeconds()',
            30 => 'everyThirtySeconds()',
            60 => 'everyMinute()',
            default => "cron(*/{$interval} * * * * *)",
        };
    }

    /**
     * Get heartbeat status
     */
    private function getHeartbeatStatus(): array
    {
        $tmpDir = \App\Providers\PathMapper::getLaravelTmpDir();
        $heartbeatFile = $tmpDir . '/octane_timer_heartbeat.txt';

        if (!file_exists($heartbeatFile)) {
            return [
                'exists' => false,
                'message' => 'Heartbeat file not found',
            ];
        }

        $lastModified = filemtime($heartbeatFile);
        $secondsAgo = time() - $lastModified;

        return [
            'exists' => true,
            'last_modified' => date('Y-m-d H:i:s', $lastModified),
            'seconds_ago' => $secondsAgo,
            'is_fresh' => $secondsAgo < 3,
            'status' => $secondsAgo < 3 ? 'alive' : 'stale',
        ];
    }

    /**
     * Verify all tasks are properly initialized
     */
    public function verifyInitialization(): array
    {
        $status = $this->getAllTasksStatus();
        $issues = [];

        if (!$status['summary']['schedule_running']) {
            $issues[] = 'Laravel Schedule heartbeat is not running';
        }

        foreach ($status['tasks'] as $task) {
            if (isset($task['error'])) {
                $issues[] = "Task {$task['class']} has error: {$task['error']}";
            }
        }

        $heartbeat = $status['heartbeat'];
        if (!$heartbeat['exists']) {
            $issues[] = 'Heartbeat file missing';
        } elseif ($heartbeat['status'] === 'stale') {
            $issues[] = "Heartbeat is stale ({$heartbeat['seconds_ago']}s ago)";
        }

        return [
            'success' => empty($issues),
            'issues' => $issues,
            'summary' => $status['summary'],
            'timestamp' => now()->toDateTimeString(),
        ];
    }

    /**
     * Get task detail by name
     */
    public function getTaskDetail(string $taskName): ?array
    {
        $allStatus = $this->getAllTasksStatus();

        foreach ($allStatus['tasks'] as $task) {
            if ($task['name'] === $taskName) {
                return $task;
            }
        }

        return null;
    }

    /**
     * Get basic data object for all tasks (for central management)
     */
    public function getBasicTaskObjects(): array
    {
        $allStatus = $this->getAllTasksStatus();
        $basic = [];

        foreach ($allStatus['tasks'] as $task) {
            $basic[] = [
                'name' => $task['name'] ?? 'unknown',
                'class' => $task['class'],
                'interval' => $task['interval'] ?? 0,
                'enabled' => $task['enabled'] ?? false,
                'status' => $task['status'],
                'schedule_method' => $task['schedule_method'] ?? 'unknown',
            ];
        }

        return $basic;
    }
}
