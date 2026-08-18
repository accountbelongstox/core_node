<?php

namespace App\Services\TimerTasks;

use App\Services\DataSync\DataSyncService;

final class DataSyncTask extends OctaneTimerTaskAbstract
{
    private DataSyncService $service;

    public function __construct()
    {
        $this->service = app(DataSyncService::class);
    }

    public function getInterval(): int
    {
        return 1;
    }

    public function exec(): void
    {
        $this->service->advance();
    }
}
