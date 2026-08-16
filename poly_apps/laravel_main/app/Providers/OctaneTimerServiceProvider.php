<?php

namespace App\Providers;

use App\Services\OctaneTimerService;
use App\Services\TimerTasks\OctaneTimerTaskInterface;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Laravel\Octane\Facades\Octane;

/**
 * OctaneTimerServiceProvider - single shared Octane heartbeat
 *
 * Registers the auto-discovered TimerTasks/* set and uses Octane::tick() as
 * the only task driver. Laravel Scheduler and queue workers are intentionally
 * outside this application's execution model.
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
        // Auto-discover and register the same timer tasks regardless of runtime
        // (cheap, in-memory only -- no I/O). This also runs for console commands
        // that never tick, keeping status and inspection commands aware of the
        // same task catalog as the Octane worker that drives the heartbeat.
        $this->autoDiscoverAndRegisterTasks();
        $this->hookOctaneTick();

        Log::info('OctaneTimerServiceProvider: Bootstrapped', [
            'tickSource' => 'octane-tick',
            'server' => 'swoole',
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
}
