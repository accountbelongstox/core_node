<?php

namespace App\Providers;

use App\Services\OctaneTimerService;
use App\Services\TimerTasks\OctaneTimerTaskInterface;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Laravel\Octane\Facades\Octane;

/**
 * OctaneTimerServiceProvider - Auto-discover and register timer tasks
 *
 * This provider automatically scans the TimerTasks directory and registers
 * all classes implementing OctaneTimerTaskInterface.
 *
 * To add a new timer task:
 * 1. Create a class in app/Services/TimerTasks/
 * 2. Implement OctaneTimerTaskInterface (or extend OctaneTimerTaskAbstract)
 * 3. Define getName(), getInterval(), and exec() methods
 * 4. Task will be auto-discovered and registered on next restart
 *
 * This follows the Common Timer Design Specification:
 * - Single timer instance (1-second heartbeat)
 * - Interceptor pattern (each task controls its own interval)
 * - Registration mode (all tasks share same timer)
 * - Resource efficient (one timer loop for all tasks)
 */
class OctaneTimerServiceProvider extends ServiceProvider
{
    /**
     * Timer tasks directory path
     */
    protected const TASKS_DIRECTORY = __DIR__ . '/../Services/TimerTasks';

    /**
     * Timer tasks namespace
     */
    protected const TASKS_NAMESPACE = 'App\\Services\\TimerTasks\\';

    /**
     * Register services
     */
    public function register(): void
    {
        // Register timer service as singleton
        $this->app->singleton(OctaneTimerService::class, function ($app) {
            return new OctaneTimerService();
        });
    }

    /**
     * Bootstrap services
     */
    public function boot(): void
    {
        // Only run on Octane-Swoole, NOT on FPM
        if (!$this->isOctaneSwooleRunning()) {
            Log::info('OctaneTimerServiceProvider: Octane runtime not detected or not using Swoole, skipping timer tasks', [
                'server' => $this->getServerType(),
                'octane_server_config' => config('octane.server'),
                'laravel_octane_env' => env('LARAVEL_OCTANE'),
            ]);
            return;
        }

        // Auto-discover and register all timer tasks
        $this->autoDiscoverAndRegisterTasks();

        // Hook into Octane tick event (single timer instance)
        $this->hookOctaneTick();

        Log::info('OctaneTimerServiceProvider: Bootstrapped on Octane-Swoole', [
            'server' => $this->getServerType(),
            'tasks' => OctaneTimerService::getRegisteredTasks()
        ]);
    }

    /**
     * Auto-discover and register all timer tasks
     *
     * Scans the TimerTasks directory for classes implementing OctaneTimerTaskInterface.
     * Automatically instantiates and registers each enabled task.
     *
     * This makes the system extensible - just add a new task class and it will be
     * automatically discovered and registered without modifying this provider.
     *
     * @return void
     */
    protected function autoDiscoverAndRegisterTasks(): void
    {
        if (!is_dir(self::TASKS_DIRECTORY)) {
            Log::warning('OctaneTimerServiceProvider: Tasks directory not found', [
                'directory' => self::TASKS_DIRECTORY
            ]);
            return;
        }

        // Get all PHP files in TimerTasks directory
        $files = glob(self::TASKS_DIRECTORY . '/*.php');
        $registeredCount = 0;
        $skippedCount = 0;

        foreach ($files as $file) {
            $className = basename($file, '.php');

            // Skip interface and abstract class files
            if (in_array($className, ['OctaneTimerTaskInterface', 'OctaneTimerTaskAbstract'])) {
                continue;
            }

            $fullClassName = self::TASKS_NAMESPACE . $className;

            // Check if class exists
            if (!class_exists($fullClassName)) {
                Log::warning('OctaneTimerServiceProvider: Task class not found', [
                    'class' => $fullClassName
                ]);
                continue;
            }

            // Check if class implements the interface
            $implements = class_implements($fullClassName);
            if (!isset($implements[OctaneTimerTaskInterface::class])) {
                Log::debug('OctaneTimerServiceProvider: Class does not implement OctaneTimerTaskInterface', [
                    'class' => $className
                ]);
                continue;
            }

            // Instantiate the task
            try {
                /** @var OctaneTimerTaskInterface $task */
                $task = new $fullClassName();

                // Check if task is enabled
                if (!$task->isEnabled()) {
                    Log::debug('OctaneTimerServiceProvider: Task is disabled', [
                        'task' => $task->getName(),
                        'class' => $className
                    ]);
                    $skippedCount++;
                    continue;
                }

                // Register the task with the timer service
                OctaneTimerService::register(
                    $task->getName(),
                    function () use ($task) {
                        $task->exec();
                    },
                    $task->getInterval()
                );

                Log::info('OctaneTimerServiceProvider: Task registered', [
                    'task' => $task->getName(),
                    'class' => $className,
                    'interval' => $task->getInterval() . 's'
                ]);

                $registeredCount++;

            } catch (\Throwable $e) {
                Log::error('OctaneTimerServiceProvider: Failed to register task', [
                    'class' => $className,
                    'error' => $e->getMessage()
                ]);
            }
        }

        Log::info('OctaneTimerServiceProvider: Auto-discovery completed', [
            'registered' => $registeredCount,
            'skipped' => $skippedCount,
            'total_files' => count($files)
        ]);
    }

    /**
     * Hook into Octane tick event
     *
     * Creates the SINGLE timer instance that all tasks share.
     * This follows the Common Timer Design Specification:
     * - One timer instance per application
     * - All tasks register with the same instance
     * - Basic 1-second heartbeat shared by all tasks
     * - Resource efficient (single timer loop)
     *
     * @return void
     */
    protected function hookOctaneTick(): void
    {
        // Start timer service (single instance)
        OctaneTimerService::start();

        // Hook into Octane tick (1 second interval)
        // This is the ONLY timer tick - all tasks share this heartbeat
        if (class_exists(\Laravel\Octane\Facades\Octane::class)) {
            try {
                Octane::tick('octane-timer-tick', function () {
                    OctaneTimerService::tick();
                })->seconds(1);

                Log::info('OctaneTimerServiceProvider: Hooked into Octane tick (single timer instance)');
            } catch (\Throwable $e) {
                Log::error('OctaneTimerServiceProvider: Failed to hook Octane tick', [
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    /**
     * Check if running on Octane-Swoole (not FPM, not RoadRunner)
     *
     * @return bool
     */
    protected function isOctaneSwooleRunning(): bool
    {
        // Check if Octane facade exists
        if (!class_exists(\Laravel\Octane\Facades\Octane::class)) {
            return false;
        }

        // Octane server config should be Swoole
        $configuredServer = config('octane.server');
        if ($configuredServer && strtolower($configuredServer) !== 'swoole') {
            return false;
        }

        // Detect Swoole extension or server runtime
        if ($this->getServerType() === 'swoole') {
            return true;
        }

        if (extension_loaded('swoole') && function_exists('swoole_get_version')) {
            return true;
        }

        // Octane marks the environment via env or server state file
        if (env('LARAVEL_OCTANE') === '1') {
            return true;
        }

        return false;
    }

    /**
     * Get server type (swoole, roadrunner, fpm, cli, or unknown)
     *
     * @return string
     */
    protected function getServerType(): string
    {
        // Check for Swoole
        if (extension_loaded('swoole') && class_exists(\Swoole\Http\Server::class)) {
            return 'swoole';
        }

        // Check for RoadRunner
        if (isset($_SERVER['RR_MODE']) || class_exists(\Spiral\RoadRunner\Worker::class)) {
            return 'roadrunner';
        }

        // Check for FPM (FastCGI)
        if (php_sapi_name() === 'fpm-fcgi' || php_sapi_name() === 'cgi-fcgi') {
            return 'fpm';
        }

        // Check for CLI
        if (php_sapi_name() === 'cli') {
            return 'cli';
        }

        return 'unknown';
    }
}
