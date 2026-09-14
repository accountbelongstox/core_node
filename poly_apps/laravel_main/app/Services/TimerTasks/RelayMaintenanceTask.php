<?php

namespace App\Services\TimerTasks;

use App\Apps\Relay\RelayServices\RelayMaintenanceService;

final class RelayMaintenanceTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 30;
    }

    public function exec(): void
    {
        app(RelayMaintenanceService::class)->runSlice();
    }
}
