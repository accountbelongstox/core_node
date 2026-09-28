<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\OctaneTimerService;
use App\Helpers\PycoreCaller;

/**
 * OctaneTimerStatus - Check Octane timer status
 *
 * Usage: php artisan octane:timer-status
 */
class OctaneTimerStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'octane:timer-status';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Display Octane timer service status and task statistics';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('=== Octane Timer Service Status ===');
        $this->newLine();

        // Get status
        $status = OctaneTimerService::getStatus();

        // Display running status
        if ($status['running']) {
            $this->info('✓ Timer is RUNNING');
        } else {
            $this->warn('✗ Timer is NOT running');
        }

        // Display uptime
        $uptime = $status['uptime'];
        if ($uptime !== null) {
            $this->info("Uptime: {$uptime} seconds");
        }

        // Display total ticks
        $this->info("Total ticks: {$status['total_ticks']}");
        $this->info("Interval: {$status['interval']} second(s)");
        $this->newLine();

        // Display tasks
        $this->info('=== Registered Tasks ===');
        $tasks = $status['tasks'];

        if (empty($tasks)) {
            $this->warn('No tasks registered');
        } else {
            $headers = ['Task', 'Interval', 'Run Count', 'Errors', 'Last Run', 'Duration'];
            $rows = [];

            foreach ($tasks as $name => $task) {
                $lastRunAgo = $task['last_run_ago'] !== null
                    ? $task['last_run_ago'] . 's ago'
                    : 'Never';

                $duration = $task['last_duration'] !== null
                    ? round($task['last_duration'] * 1000, 2) . 'ms'
                    : 'N/A';

                $rows[] = [
                    $name,
                    $task['interval'] . 's',
                    $task['run_count'],
                    $task['error_count'],
                    $lastRunAgo,
                    $duration,
                ];
            }

            $this->table($headers, $rows);
        }

        // Display heartbeat. Sourced from OctaneTimerService's own
        // cross-process heartbeat (last_alive) -- the SAME signal
        // OctaneTaskStatusService::getHeartbeatStatus() and the
        // octane/timer/test/heartbeat route use, so this can never disagree
        // with the timer status printed above. (Per-task last-run is already
        // in the "Registered Tasks" table above -- no separate section needed.)
        $this->newLine();
        $this->info('=== Heartbeat ===');
        $lastAlive = $status['last_alive'] ?? null;

        if ($lastAlive === null) {
            $this->warn('✗ No heartbeat recorded yet (timer never ticked)');
        } else {
            $secondsAgo = time() - $lastAlive;
            $this->line('Last tick: ' . date('Y-m-d H:i:s', $lastAlive));

            if ($status['running']) {
                $this->info("✓ Heartbeat is FRESH ({$secondsAgo}s ago)");
            } else {
                $this->warn("⚠ Heartbeat is STALE ({$secondsAgo}s ago)");
            }
        }

        // Display Pycore diagnostics
        $this->newLine();
        $this->info('=== Pycore Service Discovery ===');

        try {
            $diagnostics = PycoreCaller::getDiagnostics();
            $pycoreCaller = $diagnostics['pycore_caller'];
            $urlFinder = $diagnostics['url_finder'];

            $this->info("Current URL: {$pycoreCaller['current_url']}");
            $this->info("Dynamic Switching: " . ($pycoreCaller['dynamic_switching_enabled'] ? 'Enabled' : 'Disabled'));

            $env = $urlFinder['environment'];
            $this->info("Environment: WSL=" . ($env['is_wsl'] ? 'Yes' : 'No') .
                       ", Desktop=" . ($env['has_desktop'] ? 'Yes' : 'No'));

            $service = $urlFinder['service'];
            if ($service['is_available']) {
                $this->info("✓ Pycore service is AVAILABLE at: {$service['current_url']}");
            } else {
                $this->warn('✗ Pycore service NOT available');
            }
        } catch (\Exception $e) {
            $this->error("Failed to get Pycore diagnostics: {$e->getMessage()}");
        }

        return Command::SUCCESS;
    }
}
