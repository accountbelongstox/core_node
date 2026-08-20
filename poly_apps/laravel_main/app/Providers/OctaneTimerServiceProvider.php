<?php

namespace App\Providers;

use App\Services\OctaneTimerService;
use App\Services\OctaneTimerTaskCatalog;
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
     * Register services
     */
    public function register(): void
    {
        // Register timer service as singleton
        $this->app->singleton(OctaneTimerService::class, function ($app) {
            return new OctaneTimerService();
        });
        $this->app->singleton(OctaneTimerTaskCatalog::class);
    }

    /**
     * Bootstrap services
     */
    public function boot(OctaneTimerTaskCatalog $catalog): void
    {
        // Auto-discover and register the same timer tasks regardless of runtime
        // (cheap, in-memory only -- no I/O). This also runs for console commands
        // that never tick, keeping status and inspection commands aware of the
        // same task catalog as the Octane worker that drives the heartbeat.
        $this->autoDiscoverAndRegisterTasks($catalog);

        if (config('octane.server') === 'swoole') {
            $this->hookOctaneTick();
        }

        Log::info('OctaneTimerServiceProvider: Bootstrapped', [
            'tick_source' => config('octane.server') === 'swoole' ? 'octane-tick' : 'laravel-schedule',
            'server' => config('octane.server'),
            'tasks' => OctaneTimerService::getRegisteredTasks()
        ]);
    }

    /**
     * Auto-discover and register all timer tasks
     */
    protected function autoDiscoverAndRegisterTasks(OctaneTimerTaskCatalog $catalog): void
    {
        $tasks = $catalog->discover();
        $registeredCount = 0;
        $skippedCount = 0;

        foreach ($tasks as $definition) {
            if (isset($definition['error'])) {
                Log::error('OctaneTimerServiceProvider: Failed to resolve task', [
                    'class' => $definition['class'],
                    'error' => $definition['error'],
                ]);
                continue;
            }

            try {
                $task = $definition['instance'];

                if (!$definition['enabled']) {
                    Log::debug('OctaneTimerServiceProvider: Task is disabled', [
                        'task' => $definition['name'],
                        'class' => $definition['class'],
                    ]);
                    $skippedCount++;
                    continue;
                }

                OctaneTimerService::register(
                    $task->getName(),
                    function () use ($task) {
                        $task->exec();
                    },
                    $definition['interval']
                );

                Log::info('OctaneTimerServiceProvider: Task registered', [
                    'task' => $definition['name'],
                    'class' => $definition['class'],
                    'interval' => $definition['interval'] . 's'
                ]);

                $registeredCount++;

            } catch (\Throwable $e) {
                Log::error('OctaneTimerServiceProvider: Failed to register task', [
                    'class' => $definition['class'],
                    'error' => $e->getMessage()
                ]);
            }
        }

        Log::info('OctaneTimerServiceProvider: Auto-discovery completed', [
            'registered' => $registeredCount,
            'skipped' => $skippedCount,
            'total_tasks' => count($tasks)
        ]);
    }

    /**
     * Hook into Octane tick event (Linux/WSL, when Octane-Swoole is the active server)
     */
    protected function hookOctaneTick(): void
    {
        try {
            Octane::tick('octane-timer', function () {
                OctaneTimerService::heartbeat();
            })->seconds(1)->immediate();

        } catch (\Throwable $e) {
            Log::error('OctaneTimerServiceProvider: Failed to register Octane tick', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
