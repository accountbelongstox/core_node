<?php

namespace App\Services;

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
    private OctaneTimerTaskCatalog $catalog;

    public function __construct(?OctaneTimerTaskCatalog $catalog = null)
    {
        $this->catalog = $catalog ?? app(OctaneTimerTaskCatalog::class);
    }

    /**
     * Get comprehensive status of all timer tasks
     */
    public function getAllTasksStatus(): array
    {
        $registeredTasks = $this->getRegisteredTasks();
        $discoveredTasks = $this->discoverTaskClasses();
        $runtimeStatus = $this->getRuntimeStatus();

        return [
            'summary' => [
                'total_discovered' => count($discoveredTasks),
                'total_registered' => count($registeredTasks),
                'total_running' => $this->countRunning($runtimeStatus),
                'timer_running' => OctaneTimerService::isRunning(),
                'timer_uptime' => OctaneTimerService::getUptime(),
                'total_ticks' => $this->getTotalTicks(),
            ],
            'tasks' => $this->mergeTaskStatus($discoveredTasks, $registeredTasks, $runtimeStatus),
            'heartbeat' => $this->getHeartbeatStatus(),
            'timestamp' => now()->toDateTimeString(),
        ];
    }

    /**
     * Get runtime status from OctaneTimerService
     */
    private function getRuntimeStatus(): array
    {
        try {
            $status = OctaneTimerService::getStatus();
            return $status['tasks'] ?? [];
        } catch (\Throwable $e) {
            Log::warning('[OctaneTaskStatus] Failed to get runtime status', [
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

    /**
     * Get registered task names from OctaneTimerService
     */
    private function getRegisteredTasks(): array
    {
        try {
            return OctaneTimerService::getRegisteredTasks();
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * Count running tasks
     */
    private function countRunning(array $runtimeStatus): int
    {
        return count(array_filter(
            $runtimeStatus,
            static fn (array $runtime): bool => ($runtime['enabled'] ?? true) === true
        ));
    }

    /**
     * Get total ticks from timer
     */
    private function getTotalTicks(): int
    {
        try {
            $status = OctaneTimerService::getStatus();
            return $status['total_ticks'] ?? 0;
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * Discover all task classes in TimerTasks directory
     */
    private function discoverTaskClasses(): array
    {
        return $this->catalog->descriptions();
    }

    /**
     * Merge discovered, registered, and runtime status
     */
    private function mergeTaskStatus(array $discovered, array $registered, array $runtimeStatus): array
    {
        $merged = [];

        foreach ($discovered as $task) {
            $taskName = $task['name'] ?? null;

            if (!$taskName) {
                $merged[] = array_merge($task, [
                    'registered' => false,
                    'running' => false,
                    'status' => 'error',
                ]);
                continue;
            }

            $isRegistered = in_array($taskName, $registered);
            $runtime = $runtimeStatus[$taskName] ?? null;

            $merged[] = array_merge($task, [
                'registered' => $isRegistered,
                'running' => ($task['enabled'] ?? false) && $isRegistered && $runtime !== null,
                'status' => $this->determineTaskStatus($task, $isRegistered, $runtime),
                'runtime' => $runtime,
            ]);
        }

        return $merged;
    }

    /**
     * Determine task status
     */
    private function determineTaskStatus(array $task, bool $isRegistered, $runtime): string
    {
        if (isset($task['error'])) {
            return 'error';
        }

        if (!$task['enabled']) {
            return 'disabled';
        }

        if (!$isRegistered) {
            return 'not_registered';
        }

        if ($runtime === null) {
            return 'registered';
        }

        if (($runtime['error_count'] ?? 0) > 0) {
            return 'running_with_errors';
        }

        if (($runtime['run_count'] ?? 0) > 0) {
            return 'running';
        }

        return 'waiting';
    }

    /**
     * Get heartbeat status.
     *
     * Sourced from OctaneTimerService's cross-process heartbeat file. The
     * `last_alive` timestamp is written by the active runtime's sole driver and
     * remains readable by console inspection processes outside the Swoole
     * worker tree.
     */
    private function getHeartbeatStatus(): array
    {
        $status = OctaneTimerService::getStatus();
        $lastAlive = $status['last_alive'] ?? null;

        if ($lastAlive === null) {
            return [
                'exists' => false,
                'message' => 'No timer heartbeat recorded yet (timer never ticked)',
            ];
        }

        $secondsAgo = time() - $lastAlive;
        // isRunning() already applies the same staleness window this reflects.
        $isFresh = (bool) ($status['running'] ?? false);

        return [
            'exists' => true,
            'last_modified' => date('Y-m-d H:i:s', $lastAlive),
            'seconds_ago' => $secondsAgo,
            'is_fresh' => $isFresh,
            'status' => $isFresh ? 'alive' : 'stale',
        ];
    }

    /**
     * Verify all tasks are properly initialized
     */
    public function verifyInitialization(): array
    {
        $status = $this->getAllTasksStatus();
        $issues = [];

        if (!$status['summary']['timer_running']) {
            $issues[] = 'Octane timer is not running';
        }

        foreach ($status['tasks'] as $task) {
            if ($task['enabled'] && !$task['registered']) {
                $issues[] = "Task {$task['name']} is enabled but not registered";
            }

            if (isset($task['error'])) {
                $issues[] = "Task {$task['class']} has error: {$task['error']}";
            }
        }

        $heartbeat = $status['heartbeat'];
        if (!$heartbeat['exists']) {
            $issues[] = 'No timer heartbeat recorded yet (timer never ticked)';
        } elseif ($heartbeat['status'] === 'stale') {
            $issues[] = "Heartbeat is stale ({$heartbeat['seconds_ago']}s ago) -- the ticking process may have crashed";
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
                'registered' => $task['registered'] ?? false,
                'status' => $task['status'],
                'last_run' => $task['runtime']['last_run'] ?? null,
                'run_count' => $task['runtime']['run_count'] ?? 0,
                'error_count' => $task['runtime']['error_count'] ?? 0,
            ];
        }

        return $basic;
    }
}
