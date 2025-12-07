<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Laravel\Octane\Facades\Octane;

/**
 * OctaneTimerService - Common timer task system for Laravel Octane
 *
 * Provides a common timer that runs every 1 second (configurable).
 * Services can register tasks to be executed on each tick.
 *
 * Uses Swoole Tables for cross-worker state synchronization.
 * All workers share the same timer state and task statistics.
 *
 * Usage:
 *   OctaneTimerService::register('lan_scanner', function() { ... }, 10);
 *   OctaneTimerService::start();
 */
class OctaneTimerService
{
    /**
     * Registered tasks (callback storage - cannot be shared across workers)
     * Format: ['name' => ['callback' => callable, 'interval' => int]]
     */
    protected static array $tasks = [];

    /**
     * Timer interval in seconds
     */
    protected static int $timerInterval = 1;

    /**
     * Register a task
     *
     * @param string $name Task name (unique identifier)
     * @param callable $callback Task callback function
     * @param int $interval Execution interval in seconds (0 = every tick)
     * @return void
     */
    public static function register(string $name, callable $callback, int $interval = 0): void
    {
        self::$tasks[$name] = [
            'callback' => $callback,
            'interval' => $interval,
        ];

        // Initialize task stats in Swoole Table
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                Octane::table('timer_tasks')->set($name, [
                    'name' => $name,
                    'interval' => $interval,
                    'last_run' => 0,
                    'run_count' => 0,
                    'error_count' => 0,
                    'last_duration' => 0.0,
                ]);
            } catch (\Throwable $e) {
                // Fallback if table not available
            }
        }

        Log::info("OctaneTimerService: Task registered", [
            'task' => $name,
            'interval' => $interval
        ]);
    }

    /**
     * Unregister a task
     *
     * @param string $name Task name
     * @return void
     */
    public static function unregister(string $name): void
    {
        if (isset(self::$tasks[$name])) {
            unset(self::$tasks[$name]);
            Log::info("OctaneTimerService: Task unregistered", ['task' => $name]);
        }
    }

    /**
     * Start the timer (call from Octane boot)
     *
     * @return void
     */
    public static function start(): void
    {
        if (self::isRunning()) {
            Log::warning('OctaneTimerService: Timer already running');
            return;
        }

        // Set state in Swoole Table
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                Octane::table('timer_state')->set('main', [
                    'running' => 1,
                    'start_time' => time(),
                    'total_ticks' => 0,
                ]);
            } catch (\Throwable $e) {
                // Fallback to static if table not available
                Log::warning('OctaneTimerService: Swoole Table not available, using static state');
            }
        }

        Log::info('OctaneTimerService: Timer started', [
            'interval' => self::$timerInterval,
            'registered_tasks' => array_keys(self::$tasks)
        ]);
    }

    /**
     * Stop the timer
     *
     * @return void
     */
    public static function stop(): void
    {
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                Octane::table('timer_state')->set('main', [
                    'running' => 0,
                    'start_time' => 0,
                    'total_ticks' => 0,
                ]);
            } catch (\Throwable $e) {
                // Fallback
            }
        }

        Log::info('OctaneTimerService: Timer stopped', [
            'total_ticks' => self::getTotalTicks(),
            'uptime' => self::getUptime()
        ]);
    }

    /**
     * Execute timer tick (call this every second from Octane)
     *
     * The common timer ticks every 1 second. Each event has an interceptor
     * that checks if its minimum interval has been reached before executing.
     * This design allows:
     * - Common timer ticks at base frequency (1s)
     * - Each event controls its own execution frequency (5s, 10s, etc.)
     * - Events skip execution when interval not reached
     *
     * @return void
     */
    public static function tick(): void
    {
        if (!self::isRunning()) {
            return;
        }

        // Increment tick counter in Swoole Table
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                $state = Octane::table('timer_state')->get('main');
                if ($state) {
                    Octane::table('timer_state')->set('main', [
                        'running' => $state['running'],
                        'start_time' => $state['start_time'],
                        'total_ticks' => $state['total_ticks'] + 1,
                    ]);
                }
            } catch (\Throwable $e) {
                // Fallback
            }
        }

        // Execute all tasks - each task's interceptor will decide if it should run
        foreach (self::$tasks as $name => $task) {
            self::executeTaskWithInterceptor($name, $task);
        }
    }

    /**
     * Execute a task with interceptor pattern
     *
     * The interceptor checks if the task's minimum interval has been reached.
     * If not, the task execution is skipped (intercepted).
     * This allows the common timer to tick at 1s while each event
     * controls its own execution frequency.
     *
     * @param string $name Task name
     * @param array $task Task data
     * @return void
     */
    protected static function executeTaskWithInterceptor(string $name, array &$task): void
    {
        $now = time();

        // Get task stats from Swoole Table
        $taskStats = null;
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                $taskStats = Octane::table('timer_tasks')->get($name);
            } catch (\Throwable $e) {
                // Fallback
            }
        }

        if (!$taskStats) {
            return;
        }

        $timeSinceLastRun = $now - $taskStats['last_run'];

        // Interceptor: Check if minimum interval reached
        if ($task['interval'] > 0 && $timeSinceLastRun < $task['interval']) {
            return;
        }

        // Execute the task
        try {
            $startTime = microtime(true);
            call_user_func($task['callback']);
            $duration = microtime(true) - $startTime;

            // Update task stats in Swoole Table
            if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
                try {
                    Octane::table('timer_tasks')->set($name, [
                        'name' => $name,
                        'interval' => $taskStats['interval'],
                        'last_run' => $now,
                        'run_count' => $taskStats['run_count'] + 1,
                        'error_count' => $taskStats['error_count'],
                        'last_duration' => $duration,
                    ]);
                } catch (\Throwable $e) {
                    // Fallback
                }
            }

            Log::debug("OctaneTimerService: Task executed", [
                'task' => $name,
                'duration' => round($duration * 1000, 2) . 'ms',
                'run_count' => $taskStats['run_count'] + 1
            ]);

        } catch (\Throwable $e) {
            // Update error count in Swoole Table
            if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
                try {
                    Octane::table('timer_tasks')->set($name, [
                        'name' => $name,
                        'interval' => $taskStats['interval'],
                        'last_run' => $taskStats['last_run'],
                        'run_count' => $taskStats['run_count'],
                        'error_count' => $taskStats['error_count'] + 1,
                        'last_duration' => $taskStats['last_duration'],
                    ]);
                } catch (\Throwable $e2) {
                    // Fallback
                }
            }

            Log::error("OctaneTimerService: Task execution failed", [
                'task' => $name,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * Get timer status
     *
     * @return array Status information
     */
    public static function getStatus(): array
    {
        return [
            'running' => self::isRunning(),
            'interval' => self::$timerInterval,
            'total_ticks' => self::getTotalTicks(),
            'uptime' => self::getUptime(),
            'start_time' => self::getStartTime(),
            'tasks' => self::getTaskStats(),
        ];
    }

    /**
     * Get task statistics
     *
     * @return array Task statistics
     */
    public static function getTaskStats(): array
    {
        $stats = [];

        foreach (array_keys(self::$tasks) as $name) {
            $taskData = null;
            if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
                try {
                    $taskData = Octane::table('timer_tasks')->get($name);
                } catch (\Throwable $e) {
                    // Fallback
                }
            }

            if ($taskData) {
                $stats[$name] = [
                    'interval' => $taskData['interval'],
                    'run_count' => $taskData['run_count'],
                    'error_count' => $taskData['error_count'],
                    'last_run' => $taskData['last_run'],
                    'last_run_ago' => $taskData['last_run'] > 0 ? time() - $taskData['last_run'] : null,
                    'last_duration' => $taskData['last_duration'] > 0 ? $taskData['last_duration'] : null,
                    'last_error' => null,
                ];
            }
        }

        return $stats;
    }

    /**
     * Get uptime in seconds
     *
     * @return int|null Uptime in seconds
     */
    public static function getUptime(): ?int
    {
        $startTime = self::getStartTime();
        if ($startTime === null || $startTime === 0) {
            return null;
        }

        return time() - $startTime;
    }

    /**
     * Get start time from Swoole Table
     *
     * @return int|null Start time timestamp
     */
    protected static function getStartTime(): ?int
    {
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                $state = Octane::table('timer_state')->get('main');
                return $state ? $state['start_time'] : null;
            } catch (\Throwable $e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Get total ticks from Swoole Table
     *
     * @return int Total ticks
     */
    protected static function getTotalTicks(): int
    {
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                $state = Octane::table('timer_state')->get('main');
                return $state ? $state['total_ticks'] : 0;
            } catch (\Throwable $e) {
                return 0;
            }
        }
        return 0;
    }

    /**
     * Set timer interval
     *
     * @param int $seconds Interval in seconds
     * @return void
     */
    public static function setInterval(int $seconds): void
    {
        self::$timerInterval = $seconds;
    }

    /**
     * Check if timer is running
     *
     * @return bool
     */
    public static function isRunning(): bool
    {
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                $state = Octane::table('timer_state')->get('main');
                return $state ? ($state['running'] === 1) : false;
            } catch (\Throwable $e) {
                return false;
            }
        }
        return false;
    }

    /**
     * Get all registered task names
     *
     * @return array Task names
     */
    public static function getRegisteredTasks(): array
    {
        return array_keys(self::$tasks);
    }

    /**
     * Clear all tasks
     *
     * @return void
     */
    public static function clearAllTasks(): void
    {
        self::$tasks = [];
        Log::info('OctaneTimerService: All tasks cleared');
    }

    /**
     * Reset statistics
     *
     * @return void
     */
    public static function resetStats(): void
    {
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                // Reset timer state
                Octane::table('timer_state')->set('main', [
                    'running' => 1,
                    'start_time' => time(),
                    'total_ticks' => 0,
                ]);

                // Reset all task stats
                foreach (array_keys(self::$tasks) as $name) {
                    $taskData = Octane::table('timer_tasks')->get($name);
                    if ($taskData) {
                        Octane::table('timer_tasks')->set($name, [
                            'name' => $name,
                            'interval' => $taskData['interval'],
                            'last_run' => 0,
                            'run_count' => 0,
                            'error_count' => 0,
                            'last_duration' => 0.0,
                        ]);
                    }
                }
            } catch (\Throwable $e) {
                // Fallback
            }
        }

        Log::info('OctaneTimerService: Statistics reset');
    }
}
