<?php

namespace App\Services;

use App\Services\TimerTasks\OctaneTimerTaskInterface;
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
    private const ENABLED_RECHECK_SECONDS = 15;
    private const BACKGROUND_LOOP_SECONDS = 59;
    private const LOOP_PERIOD_MICROSECONDS = 1000000;

    /**
     * Registered tasks (callback storage - cannot be shared across workers)
     * Format: ['name' => ['callback' => callable, 'interval' => int,
     *   'execution_mode' => string, 'task_class' => string]]
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
     * Read state from the Swoole table, the in-process store, then the single
     * cross-process heartbeat snapshot. The old per-key file-cache mirror was
     * removed because it multiplied every one-second tick into many disk writes.
     */
    protected static function stateGet(string $table, string $key): ?array
    {
        if (config('octane.server') === 'swoole') {
            try {
                $value = Octane::table($table)->get($key);
                if ($value !== null && $value !== false) {
                    return $value;
                }
            } catch (\Throwable $e) {
                // Not running under Octane-Swoole -- fall through to the store below.
            }
        }

        $local = self::$fallbackStore["{$table}:{$key}"] ?? null;
        if ($local !== null) {
            return $local;
        }

        return self::readHeartbeatFile()["{$table}:{$key}"] ?? null;
    }

    /**
     * Write hot state only to memory / Swoole. tick() checkpoints one complete
     * heartbeat snapshot after scheduling, instead of rewriting the same JSON
     * document before and after every task.
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
        }
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

        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            return [];
        }
        try {
            if (!@flock($handle, LOCK_SH)) {
                return [];
            }
            $raw = stream_get_contents($handle);
            @flock($handle, LOCK_UN);
        } finally {
            @fclose($handle);
        }
        if ($raw === false) {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Best-effort cross-process write of the tasks this process drives. The
     * snapshot is merged under an exclusive lock, so the heartbeat process and
     * the background-lane process never overwrite each other's task state.
     * A new `schedule:run` process seeds `last_run` from it (register()), so
     * long intervals survive the per-minute process restart. Never throws.
     */
    protected static function writeHeartbeatSnapshot(array $taskNames, bool $includeTimerState): void
    {
        $path = '';
        $dir = '';
        $handle = false;
        $updates = [];
        $snapshot = [];
        $raw = '';
        $state = null;

        try {
            foreach ($taskNames as $name) {
                $state = self::$fallbackStore["timer_tasks:{$name}"] ?? null;
                if (is_array($state)) {
                    $updates["timer_tasks:{$name}"] = $state;
                }
            }
            $state = $includeTimerState ? (self::$fallbackStore['timer_state:main'] ?? null) : null;
            if (is_array($state)) {
                $updates['timer_state:main'] = $state;
            }

            $path = self::heartbeatFilePath();
            $dir = dirname($path);
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
            $handle = @fopen($path, 'c+b');
            if ($handle === false || !@flock($handle, LOCK_EX)) {
                return;
            }
            $raw = (string) stream_get_contents($handle);
            $snapshot = json_decode($raw === '' ? '[]' : $raw, true);
            $snapshot = array_replace(is_array($snapshot) ? $snapshot : [], $updates, ['updated_at' => time()]);
            @ftruncate($handle, 0);
            @rewind($handle);
            @fwrite($handle, (string) json_encode($snapshot));
            @fflush($handle);
            @flock($handle, LOCK_UN);
        } catch (\Throwable $e) {
            // Best-effort -- diagnostics must never break the tick.
        } finally {
            if (is_resource($handle)) {
                @fclose($handle);
            }
        }
    }

    /**
     * Register a task
     *
     * @param string $name Task name (unique identifier)
     * @param callable $callback Task callback function
     * @param int $interval Execution interval in seconds (0 = every tick)
     * @param callable|null $enabled
     * @param string $executionMode
     * @param string|null $taskClass
     * @return void
     */
    public static function register(
        string $name,
        callable $callback,
        int $interval = 0,
        ?callable $enabled = null,
        string $executionMode = OctaneTimerTaskInterface::EXECUTION_INLINE,
        ?string $taskClass = null
    ): void
    {
        $current = self::stateGet('timer_tasks', $name);

        self::$tasks[$name] = [
            'callback' => $callback,
            'interval' => $interval,
            'enabled' => $enabled,
            'execution_mode' => $executionMode,
            'task_class' => $taskClass,
        ];

        self::stateSet('timer_tasks', $name, [
            'name' => $name,
            'interval' => $interval,
            'last_run' => (int) ($current['last_run'] ?? 0),
            'run_count' => (int) ($current['run_count'] ?? 0),
            'error_count' => (int) ($current['error_count'] ?? 0),
            'last_duration' => (float) ($current['last_duration'] ?? 0.0),
            'last_error' => (string) ($current['last_error'] ?? ''),
            'enabled' => $current['enabled'] ?? null,
            'enabled_checked_at' => (int) ($current['enabled_checked_at'] ?? 0),
            'in_flight' => false,
            'in_flight_at' => 0,
            'execution_mode' => $executionMode,
        ]);

        Log::info("OctaneTimerService: Task registered", [
            'task' => $name,
            'interval' => $interval,
            'execution_mode' => $executionMode,
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

        // Execute the heartbeat-lane tasks - each task's interceptor will decide
        // if it should run. Background-lane tasks run in backgroundLoop().
        foreach (self::$tasks as $name => $task) {
            if (!self::runsInBackgroundLane($task)) {
                self::executeTaskWithInterceptor($name, $task);
            }
        }
        self::writeHeartbeatSnapshot(self::laneTaskNames(false), true);
    }

    /**
     * Background lane for slow tasks (EXECUTION_BACKGROUND) on non-Swoole
     * runtimes: a separate scheduled process runs them on its own one-second
     * loop for about a minute, so AI calls, archive work or certbot never
     * stall the heartbeat tasks (outbox publish, result write-back).
     */
    public static function backgroundLoop(): void
    {
        $deadline = time() + self::BACKGROUND_LOOP_SECONDS;
        $started = 0.0;
        $remaining = 0;

        do {
            $started = microtime(true);
            if (self::isRunning()) {
                foreach (self::$tasks as $name => $task) {
                    if (self::runsInBackgroundLane($task)) {
                        self::executeTaskWithInterceptor($name, $task);
                    }
                }
                self::writeHeartbeatSnapshot(self::laneTaskNames(true), false);
            }
            $remaining = self::LOOP_PERIOD_MICROSECONDS - (int) ((microtime(true) - $started) * 1000000);
            if ($remaining > 0) {
                usleep($remaining);
            }
        } while (time() < $deadline);
    }

    protected static function runsInBackgroundLane(array $task): bool
    {
        return config('octane.server') !== 'swoole'
            && ($task['execution_mode'] ?? OctaneTimerTaskInterface::EXECUTION_INLINE) === OctaneTimerTaskInterface::EXECUTION_BACKGROUND;
    }

    /**
     * @return array<int, string>
     */
    protected static function laneTaskNames(bool $background): array
    {
        return array_keys(array_filter(
            self::$tasks,
            static fn (array $task): bool => self::runsInBackgroundLane($task) === $background
        ));
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
