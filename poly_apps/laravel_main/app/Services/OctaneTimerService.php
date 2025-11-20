<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * OctaneTimerService - Common timer task system for Laravel Octane
 *
 * Provides a common timer that runs every 1 second (configurable).
 * Services can register tasks to be executed on each tick.
 *
 * Usage:
 *   OctaneTimerService::register('lan_scanner', function() { ... }, 10);
 *   OctaneTimerService::start();
 */
class OctaneTimerService
{
    /**
     * Registered tasks
     * Format: ['name' => ['callback' => callable, 'interval' => int, 'last_run' => int]]
     */
    protected static array $tasks = [];

    /**
     * Timer interval in seconds
     */
    protected static int $timerInterval = 1;

    /**
     * Whether timer is running
     */
    protected static bool $running = false;

    /**
     * Timer start time
     */
    protected static ?int $startTime = null;

    /**
     * Total ticks
     */
    protected static int $totalTicks = 0;

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
            'last_run' => 0,
            'run_count' => 0,
            'error_count' => 0,
            'last_error' => null,
        ];

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
        if (self::$running) {
            Log::warning('OctaneTimerService: Timer already running');
            return;
        }

        self::$running = true;
        self::$startTime = time();
        self::$totalTicks = 0;

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
        self::$running = false;
        Log::info('OctaneTimerService: Timer stopped', [
            'total_ticks' => self::$totalTicks,
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
        if (!self::$running) {
            return;
        }

        self::$totalTicks++;

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
        $timeSinceLastRun = $now - $task['last_run'];

        // Interceptor: Check if minimum interval reached
        // interval = 0 means run on every tick (no interception)
        // interval > 0 means only run when time elapsed >= interval
        if ($task['interval'] > 0 && $timeSinceLastRun < $task['interval']) {
            // Interval not reached - skip this execution
            return;
        }

        // Interval reached or interval is 0 - execute the task
        try {
            $startTime = microtime(true);

            // Execute callback
            call_user_func($task['callback']);

            $duration = microtime(true) - $startTime;

            // Update task stats
            self::$tasks[$name]['last_run'] = $now;
            self::$tasks[$name]['run_count']++;
            self::$tasks[$name]['last_duration'] = $duration;

            Log::debug("OctaneTimerService: Task executed", [
                'task' => $name,
                'duration' => round($duration * 1000, 2) . 'ms',
                'run_count' => self::$tasks[$name]['run_count']
            ]);

        } catch (\Throwable $e) {
            self::$tasks[$name]['error_count']++;
            self::$tasks[$name]['last_error'] = $e->getMessage();

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
            'running' => self::$running,
            'interval' => self::$timerInterval,
            'total_ticks' => self::$totalTicks,
            'uptime' => self::getUptime(),
            'start_time' => self::$startTime,
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

        foreach (self::$tasks as $name => $task) {
            $stats[$name] = [
                'interval' => $task['interval'],
                'run_count' => $task['run_count'],
                'error_count' => $task['error_count'],
                'last_run' => $task['last_run'],
                'last_run_ago' => $task['last_run'] > 0 ? time() - $task['last_run'] : null,
                'last_duration' => $task['last_duration'] ?? null,
                'last_error' => $task['last_error'] ?? null,
            ];
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
        if (self::$startTime === null) {
            return null;
        }

        return time() - self::$startTime;
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
        return self::$running;
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
        self::$totalTicks = 0;
        self::$startTime = time();

        foreach (self::$tasks as $name => $task) {
            self::$tasks[$name]['run_count'] = 0;
            self::$tasks[$name]['error_count'] = 0;
            self::$tasks[$name]['last_error'] = null;
        }

        Log::info('OctaneTimerService: Statistics reset');
    }
}
