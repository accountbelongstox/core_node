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

        // Hook into Octane tick event (single heartbeat center)
        // This runs Laravel Schedule every second, which drives all sub-minute tasks
        $this->hookOctaneTick();

        Log::info('OctaneTimerServiceProvider: Bootstrapped on Octane-Swoole with Laravel Schedule', [
            'server' => $this->getServerType(),
        ]);
    }


    /**
     * Hook into Octane tick event
     *
     * Creates the SINGLE heartbeat center that drives all scheduled tasks.
     * This follows the Common Timer Design Specification:
     * - One timer instance per application (Octane tick)
     * - All tasks registered via Laravel Schedule in routes/console.php
     * - Basic 1-second heartbeat runs schedule:run every second
     * - Resource efficient (single timer loop, standard Laravel Schedule)
     * - Extensible (add tasks to routes/console.php, auto-discovered from TimerTasks directory)
     *
     * @return void
     */
    protected function hookOctaneTick(): void
    {
        if (!class_exists(\Laravel\Octane\Facades\Octane::class)) {
            return;
        }

        try {
            // Single heartbeat center: run Laravel Schedule every second
            // This allows sub-minute tasks (everySecond, everyFiveSeconds, etc.) to work
            Octane::tick('laravel-schedule-runner', function () {
                \Illuminate\Support\Facades\Artisan::call('schedule:run');
            })->seconds(1)->immediate();

            Log::info('OctaneTimerServiceProvider: Laravel Schedule runner registered', [
                'heartbeat_interval' => '1 second',
                'method' => 'Octane::tick',
            ]);

        } catch (\Throwable $e) {
            Log::error('OctaneTimerServiceProvider: Failed to register schedule runner', [
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
