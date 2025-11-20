<?php

namespace App\Services\TimerTasks;

use App\Providers\PathMapper;
use App\Services\OctaneTimerService;

/**
 * Test Timer Heartbeat Task
 *
 * Updates a heartbeat file every second with current timestamp and tick count.
 * Used to verify timer is running correctly.
 */
class TestTimerHeartbeatTask extends OctaneTimerTaskAbstract
{
    /**
     * @inheritDoc
     */
    public function getName(): string
    {
        return 'test_timer_heartbeat';
    }

    /**
     * @inheritDoc
     */
    public function getInterval(): int
    {
        return 1; // Every 1 second
    }

    /**
     * @inheritDoc
     */
    public function exec(): void
    {
        try {
            $tmpDir = PathMapper::getLaravelTmpDir();
            $filePath = $tmpDir . '/octane_timer_heartbeat.txt';

            $timestamp = date('Y-m-d H:i:s');
            $tickCount = OctaneTimerService::getStatus()['total_ticks'];

            $content = "Octane Timer - Heartbeat\n";
            $content .= "========================\n";
            $content .= "Last Update: {$timestamp}\n";
            $content .= "Total Ticks: {$tickCount}\n";
            $content .= "Status: Running\n";
            $content .= "========================\n";

            file_put_contents($filePath, $content);

        } catch (\Throwable $e) {
            $this->logError('Failed to update heartbeat file', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
