<?php

namespace App\Providers;

use App\Services\OctaneTimerService;
use App\Services\TimerTasks\OctaneTimerTaskInterface;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Laravel\Octane\Facades\Octane;

/**
 * OctaneTimerServiceProvider - Laravel Schedule Single Heartbeat Center
 *
 * This provider registers a single Octane tick that runs Laravel Schedule every second.
 * This allows sub-minute tasks (everySecond, everyFiveSeconds, etc.) to work in Octane.
 *
 * To add a new timer task:
 * 1. Create a class in app/Services/TimerTasks/
 * 2. Implement OctaneTimerTaskInterface (or extend OctaneTimerTaskAbstract)
 * 3. Define getName(), getInterval(), and exec() methods
 * 4. Task will be auto-discovered in routes/console.php and registered to Laravel Schedule
 *
 * This follows the Common Timer Design Specification:
 * - Single heartbeat center (1-second Octane tick)
 * - Standard Laravel Schedule (official Laravel pattern)
 * - Auto-discovery pattern (extensible via TimerTasks directory)
 * - Resource efficient (one timer loop drives all tasks)
 * - Fully compatible with Laravel ecosystem
 */
class OctaneTimerServiceProvider extends ServiceProvider
{
    /**
     * Timer tasks directory path
     */
    private const TASKS_DIRECTORY = __DIR__ . '/../Services/TimerTasks';

    /**
     * Timer tasks namespace
     */
    private const TASKS_NAMESPACE = 'App\\Services\\TimerTasks\\';

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
        $isOctane = $this->isOctaneSwooleRunning();
        $serverType = $this->getServerType();
        $octaneClass = class_exists(\Laravel\Octane\Facades\Octane::class);
        $configuredServer = config('octane.server');
        $extensionLoaded = extension_loaded('swoole');
        $swooleVersion = extension_loaded('swoole') && function_exists('swoole_get_version');
        $swooleHttpServer = class_exists(\Swoole\Http\Server::class);
        $octaneEnv = env('LARAVEL_OCTANE');

        Log::info('OctaneTimerServiceProvider: Boot called', [
            'isOctaneSwooleRunning' => $isOctane,
            'serverType' => $serverType,
            'octaneClassExists' => $octaneClass,
            'configuredServer' => $configuredServer,
            'extensionLoaded' => $extensionLoaded,
            'swooleVersionFunction' => $swooleVersion,
            'swooleHttpServerClass' => $swooleHttpServer,
            'octaneEnv' => $octaneEnv,
        ]);

        // Only run on Octane-Swoole, NOT on FPM
        if (!$isOctane) {
            Log::info('OctaneTimerServiceProvider: Octane runtime not detected or not using Swoole, skipping timer tasks');
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
     */
    protected function autoDiscoverAndRegisterTasks(): void
    {
        if (!is_dir(self::TASKS_DIRECTORY)) {
            Log::warning('OctaneTimerServiceProvider: Tasks directory not found', [
                'directory' => self::TASKS_DIRECTORY
            ]);
            return;
        }

        $files = glob(self::TASKS_DIRECTORY . '/*.php');
        $registeredCount = 0;
        $skippedCount = 0;

        foreach ($files as $file) {
            $className = basename($file, '.php');

            if (in_array($className, ['OctaneTimerTaskInterface', 'OctaneTimerTaskAbstract'])) {
                continue;
            }

            $fullClassName = self::TASKS_NAMESPACE . $className;

            if (!class_exists($fullClassName)) {
                Log::warning('OctaneTimerServiceProvider: Task class not found', [
                    'class' => $fullClassName
                ]);
                continue;
            }

            $implements = class_implements($fullClassName);
            if (!isset($implements[OctaneTimerTaskInterface::class])) {
                Log::debug('OctaneTimerServiceProvider: Class does not implement OctaneTimerTaskInterface', [
                    'class' => $className
                ]);
                continue;
            }

            try {
                $task = new $fullClassName();

                if (!$task->isEnabled()) {
                    Log::debug('OctaneTimerServiceProvider: Task is disabled', [
                        'task' => $task->getName(),
                        'class' => $className
                    ]);
                    $skippedCount++;
                    continue;
                }

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
     */
    protected function hookOctaneTick(): void
    {
        if (!class_exists(\Laravel\Octane\Facades\Octane::class)) {
            return;
        }

        try {
            Octane::tick('octane-timer', function () {
                if (!OctaneTimerService::isRunning()) {
                    OctaneTimerService::start();
                }
                OctaneTimerService::tick();
            })->seconds(1)->immediate();

        } catch (\Throwable $e) {
            Log::error('OctaneTimerServiceProvider: Failed to register tick', [
                'error' => $e->getMessage()
            ]);
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
