<?php

namespace App\Providers;

use App\Services\OctaneTimerService;
use App\Services\TimerTasks\OctaneTimerTaskInterface;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Laravel\Octane\Facades\Octane;

/**
 * OctaneTimerServiceProvider - single shared heartbeat, two possible tick sources
 *
 * Registers the SAME auto-discovered TimerTasks/* set on every runtime, then
 * hooks exactly ONE tick source to drive them (never both, so there is never
 * a duplicate driver):
 *   - Octane-Swoole active (`octane:start`)            -> Octane::tick() (1s).
 *   - Everywhere else (composer dev/dev:win, node-free
 *     fallback, Windows -- Octane's HTTP server cannot
 *     run there)                                        -> Laravel Schedule
 *     ->everySecond(), consumed by `php artisan schedule:work`.
 * Both paths call the same OctaneTimerService::tick(), so task behavior is
 * identical across Linux/WSL and Windows; only the outer heartbeat differs.
 *
 * To add a new timer task:
 * 1. Create a class in app/Services/TimerTasks/
 * 2. Implement OctaneTimerTaskInterface (or extend OctaneTimerTaskAbstract)
 * 3. Define getName(), getInterval(), and exec() methods
 * 4. Task is auto-discovered here and driven by whichever tick source is active
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

        // Auto-discover and register the SAME timer tasks regardless of runtime
        // (cheap, in-memory only -- no I/O). This also runs on processes that
        // never tick (e.g. a request under `artisan serve`), which is what keeps
        // OctaneTimerService::getRegisteredTasks()/getStatus() reporting the real
        // task list from any process, not just the one actually driving the tick.
        $this->autoDiscoverAndRegisterTasks();

        // Hook exactly ONE tick source (never both -> never a duplicate driver).
        if ($isOctane) {
            $this->hookOctaneTick();
        } else {
            $this->hookScheduleTick();
        }

        Log::info('OctaneTimerServiceProvider: Bootstrapped', [
            'tickSource' => $isOctane ? 'octane-tick' : 'laravel-schedule',
            'server' => $serverType,
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
     * Hook into Octane tick event (Linux/WSL, when Octane-Swoole is the active server)
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
            Log::error('OctaneTimerServiceProvider: Failed to register Octane tick', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Hook into a Laravel Schedule ->everySecond() tick, consumed by
     * `php artisan schedule:work`. This is the tick source whenever Octane-Swoole
     * is not the active server (composer dev / dev:win, node-free fallback,
     * Windows -- Octane's HTTP server cannot run there). Pure userland PHP, no
     * Swoole/pcntl dependency, so it runs identically on Linux and Windows.
     */
    protected function hookScheduleTick(): void
    {
        try {
            $schedule = $this->app->make(Schedule::class);
            $schedule->call(function () {
                if (!OctaneTimerService::isRunning()) {
                    OctaneTimerService::start();
                }
                OctaneTimerService::tick();
            })->everySecond()->name('shared-timer-tick');

        } catch (\Throwable $e) {
            Log::error('OctaneTimerServiceProvider: Failed to register Schedule tick', [
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
