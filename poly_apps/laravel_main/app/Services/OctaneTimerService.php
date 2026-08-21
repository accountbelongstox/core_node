<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Laravel\Octane\Facades\Octane;

/**
 * OctaneTimerService - Swoole-shared timer task system
 *
 * OctaneTimerServiceProvider registers a one-second Octane::tick() heartbeat.
 * Task state lives in Swoole Tables and is shared by every request and task
 * worker in the Octane server process tree. Laravel Scheduler and queue workers
 * are intentionally not timer drivers in this application.
 *
 * A small JSON heartbeat under the Laravel runtime directory mirrors Swoole
 * state for console inspection commands, which run outside the Octane process
 * tree. The in-process array remains a defensive read/write store when such a
 * command cannot access a Swoole table; it never drives timer execution.
 *
 * Callers never need to know which backend is active — stateGet/stateSet pick
 * the right tier automatically per call.
 *
 * Usage:
 *   OctaneTimerService::register('lan_scanner', function() { ... }, 10);
 *   OctaneTimerService::start();
 */
class OctaneTimerService
{
    private const TASK_LEASE_SECONDS = 900;
    private const STATE_CACHE_PREFIX = 'octane_timer:state:';

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
     * In-process fallback store, keyed by "table:key". Used whenever the
     * Swoole table isn't available (i.e. not running under Octane-Swoole).
     */
    protected static array $fallbackStore = [];

    /**
     * Read state: Swoole table, then the in-process store (both process-local
     * or worker-local), then the cross-process heartbeat file — the only tier
     * a DIFFERENT process than the one ticking can actually see.
     */
    protected static function stateGet(string $table, string $key): ?array
    {
        $shared = null;

        if (config('octane.server') === 'swoole') {
            try {
                $value = Octane::table($table)->get($key);
                if ($value !== null && $value !== false) {
                    return $value;
                }
            } catch (\Throwable $e) {
                // Not running under Octane-Swoole -- fall through to the store below.
            }
        } else {
            try {
                $shared = Cache::store('file')->get(self::STATE_CACHE_PREFIX . $table . ':' . $key);
                if (is_array($shared)) {
                    self::$fallbackStore["{$table}:{$key}"] = $shared;
                    return $shared;
                }
            } catch (\Throwable $e) {
                // The heartbeat file below remains the cross-process fallback.
            }
        }

        $local = self::$fallbackStore["{$table}:{$key}"] ?? null;
        if ($local !== null) {
            return $local;
        }

        return self::readHeartbeatFile()["{$table}:{$key}"] ?? null;
    }

    /**
     * Write state to the in-process store, the Swoole table (when available),
     * AND the cross-process heartbeat file — so a read from ANY process, on
     * ANY backend, sees what the actually-ticking process last wrote.
     */
    protected static function stateSet(string $table, string $key, array $value): void
    {
        self::$fallbackStore["{$table}:{$key}"] = $value;

        if (config('octane.server') === 'swoole') {
            try {
                Octane::table($table)->set($key, $value);
            } catch (\Throwable $e) {
                // Not running under Octane-Swoole -- the store above already holds it.
            }
        } else {
            try {
                Cache::store('file')->forever(self::STATE_CACHE_PREFIX . $table . ':' . $key, $value);
            } catch (\Throwable $e) {
                // The heartbeat file below remains the cross-process fallback.
            }
        }

        self::writeHeartbeatFile($table, $key, $value);
    }

    /** Cross-process state file path (Laravel tmp dir — cross-platform). */
    protected static function heartbeatFilePath(): string
    {
        return rtrim(\App\Providers\PathMapper::getLaravelTmpDir(), '/\\') . '/octane_timer_heartbeat.json';
    }

    /**
     * Best-effort cross-process read. Never throws -- a missing/corrupt file
     * just means no cross-process state is available yet (fresh install, or
     * the ticking process hasn't written anything since boot).
     */
    protected static function readHeartbeatFile(): array
    {
        $path = self::heartbeatFilePath();
        if (!is_file($path)) {
            return [];
        }

        $raw = @file_get_contents($path);
        if ($raw === false) {
            return [];
        }

        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Best-effort cross-process write. Never throws -- this is a diagnostics
     * mirror, it must never be able to break a tick.
     */
    protected static function writeHeartbeatFile(string $table, string $key, array $value): void
    {
        try {
            $path = self::heartbeatFilePath();
            $dir = dirname($path);
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }

            $all = self::readHeartbeatFile();
            $all["{$table}:{$key}"] = $value;
            $all['updated_at'] = time();
            @file_put_contents($path, json_encode($all), LOCK_EX);
        } catch (\Throwable $e) {
            // Best-effort -- diagnostics must never break the tick.
        }
    }

    /**
     * Register a task
     *
     * @param string $name Task name (unique identifier)
     * @param callable $callback Task callback function
     * @param int $interval Execution interval in seconds (0 = every tick)
     * @param callable|null $enabled
     * @return void
     */
    public static function register(
        string $name,
        callable $callback,
        int $interval = 0,
        ?callable $enabled = null
    ): void
    {
        $current = self::stateGet('timer_tasks', $name);

        self::$tasks[$name] = [
            'callback' => $callback,
            'interval' => $interval,
            'enabled' => $enabled,
        ];

        self::stateSet('timer_tasks', $name, [
            'name' => $name,
            'interval' => $interval,
            'last_run' => (int) ($current['last_run'] ?? 0),
            'run_count' => (int) ($current['run_count'] ?? 0),
            'error_count' => (int) ($current['error_count'] ?? 0),
            'last_duration' => (float) ($current['last_duration'] ?? 0.0),
            'last_error' => (string) ($current['last_error'] ?? ''),
        ]);

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

        self::stateSet('timer_state', 'main', [
            'running' => 1,
            'start_time' => time(),
            'total_ticks' => 0,
        ]);

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
        self::stateSet('timer_state', 'main', [
            'running' => 0,
            'start_time' => 0,
            'total_ticks' => 0,
        ]);

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

        // Increment tick counter and stamp liveness (isRunning() uses
        // last_alive to distinguish "genuinely ticking" from "a crashed
        // process's last state write is still sitting on disk").
        $state = self::stateGet('timer_state', 'main');
        if ($state) {
            self::stateSet('timer_state', 'main', [
                'running' => $state['running'],
                'start_time' => $state['start_time'],
                'total_ticks' => $state['total_ticks'] + 1,
                'last_alive' => time(),
            ]);
        }

        // Execute all tasks - each task's interceptor will decide if it should run
        foreach (self::$tasks as $name => $task) {
            self::executeTaskWithInterceptor($name, $task);
        }
    }

    public static function heartbeat(): void
    {
        if (!self::isRunning()) {
            self::start();
        }

        self::tick();
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
        $taskStats = self::stateGet('timer_tasks', $name);
        $lock = null;

        if (!$taskStats) {
            return;
        }

        $timeSinceLastRun = $now - $taskStats['last_run'];

        // Interceptor: Check if minimum interval reached
        if ($task['interval'] > 0 && $timeSinceLastRun < $task['interval']) {
            return;
        }

        if (!self::isTaskEnabled($name, $task)) {
            return;
        }

        $lock = Cache::store('file')->lock(
            'octane_timer:task:' . sha1($name),
            self::TASK_LEASE_SECONDS
        );
        if (!$lock->get()) {
            return;
        }

        try {
            $taskStats = self::stateGet('timer_tasks', $name);
            if (!$taskStats) {
                return;
            }

            $now = time();
            $timeSinceLastRun = $now - $taskStats['last_run'];
            if ($task['interval'] > 0 && $timeSinceLastRun < $task['interval']) {
                return;
            }
            if (!self::isTaskEnabled($name, $task)) {
                return;
            }

            self::stateSet('timer_tasks', $name, [
                'name' => $name,
                'interval' => $taskStats['interval'],
                'last_run' => $now,
                'run_count' => $taskStats['run_count'],
                'error_count' => $taskStats['error_count'],
                'last_duration' => $taskStats['last_duration'],
                'last_error' => (string) ($taskStats['last_error'] ?? ''),
            ]);

            $startTime = microtime(true);
            call_user_func($task['callback']);
            $duration = microtime(true) - $startTime;

            self::stateSet('timer_tasks', $name, [
                'name' => $name,
                'interval' => $taskStats['interval'],
                'last_run' => $now,
                'run_count' => $taskStats['run_count'] + 1,
                'error_count' => $taskStats['error_count'],
                'last_duration' => $duration,
                'last_error' => '',
            ]);

            Log::debug("OctaneTimerService: Task executed", [
                'task' => $name,
                'duration' => round($duration * 1000, 2) . 'ms',
                'run_count' => $taskStats['run_count'] + 1
            ]);

        } catch (\Throwable $e) {
            self::stateSet('timer_tasks', $name, [
                'name' => $name,
                'interval' => $taskStats['interval'],
                'last_run' => $now,
                'run_count' => $taskStats['run_count'],
                'error_count' => $taskStats['error_count'] + 1,
                'last_duration' => $taskStats['last_duration'],
                'last_error' => mb_substr($e->getMessage(), 0, 1024),
            ]);

            Log::error("OctaneTimerService: Task execution failed", [
                'task' => $name,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        } finally {
            $lock->release();
        }
    }

    protected static function isTaskEnabled(string $name, array $task): bool
    {
        $enabled = $task['enabled'] ?? null;

        if (!is_callable($enabled)) {
            return true;
        }

        try {
            return (bool) call_user_func($enabled);
        } catch (\Throwable $e) {
            Log::error('OctaneTimerService: Task enable check failed', [
                'task' => $name,
                'error' => $e->getMessage(),
            ]);
            return false;
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
            // Last tick timestamp, readable cross-process (heartbeat file tier)
            // -- this is the real "is the process that owns the tick loop still
            // alive" signal; isRunning() already folds its staleness into the
            // 'running' field above.
            'last_alive' => self::getLastAlive(),
            'tasks' => self::getTaskStats(),
        ];
    }

    /**
     * @return int|null Unix timestamp of the last tick(), or null if the
     *                   timer has never ticked (fresh install / never started).
     */
    protected static function getLastAlive(): ?int
    {
        $state = self::stateGet('timer_state', 'main');
        return $state['last_alive'] ?? null;
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
            $taskData = self::stateGet('timer_tasks', $name);

            if ($taskData) {
                $stats[$name] = [
                    'enabled' => self::isTaskEnabled($name, self::$tasks[$name]),
                    'interval' => $taskData['interval'],
                    'run_count' => $taskData['run_count'],
                    'error_count' => $taskData['error_count'],
                    'last_run' => $taskData['last_run'],
                    'last_run_ago' => $taskData['last_run'] > 0 ? time() - $taskData['last_run'] : null,
                    'last_duration' => $taskData['last_duration'] > 0 ? $taskData['last_duration'] : null,
                    'last_error' => ($taskData['last_error'] ?? '') !== ''
                        ? $taskData['last_error']
                        : null,
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
     * Get start time
     *
     * @return int|null Start time timestamp
     */
    protected static function getStartTime(): ?int
    {
        $state = self::stateGet('timer_state', 'main');
        return $state ? $state['start_time'] : null;
    }

    /**
     * Get total ticks
     *
     * @return int Total ticks
     */
    protected static function getTotalTicks(): int
    {
        $state = self::stateGet('timer_state', 'main');
        return $state ? $state['total_ticks'] : 0;
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

    /** Heartbeat older than this (seconds) means the ticking process died without calling stop(). */
    private const STALE_AFTER_SECONDS = 5;

    /**
     * Check if timer is running. A `last_alive` stamp older than
     * STALE_AFTER_SECONDS is treated as not-running -- otherwise a process
     * that crashed (kill -9, OOM) mid-tick would report "running" forever
     * from its last state write, cross-process, since nothing ever calls
     * stop() to clear it.
     *
     * @return bool
     */
    public static function isRunning(): bool
    {
        $state = self::stateGet('timer_state', 'main');
        if (!$state || ($state['running'] ?? 0) !== 1) {
            return false;
        }

        $lastAlive = $state['last_alive'] ?? null;
        if ($lastAlive !== null && (time() - $lastAlive) > self::STALE_AFTER_SECONDS) {
            return false;
        }

        return true;
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
        self::stateSet('timer_state', 'main', [
            'running' => 1,
            'start_time' => time(),
            'total_ticks' => 0,
        ]);

        foreach (array_keys(self::$tasks) as $name) {
            $taskData = self::stateGet('timer_tasks', $name);
            if ($taskData) {
                self::stateSet('timer_tasks', $name, [
                    'name' => $name,
                    'interval' => $taskData['interval'],
                    'last_run' => 0,
                    'run_count' => 0,
                    'error_count' => 0,
                    'last_duration' => 0.0,
                ]);
            }
        }

        Log::info('OctaneTimerService: Statistics reset');
    }
}
