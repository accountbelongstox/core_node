<?php

namespace App\Services\TimerTasks;

use App\Apps\RelayV2\RelayV2Services\RelayV2MaintenanceService;

final class RelayV2MaintenanceTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 30;
    }

    public function exec(): void
    {
        app(RelayV2MaintenanceService::class)->runSlice();
    }
}
