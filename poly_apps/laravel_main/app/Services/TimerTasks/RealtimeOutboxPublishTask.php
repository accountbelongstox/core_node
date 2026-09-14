<?php

namespace App\Services\TimerTasks;

use App\Services\Realtime\RealtimeOutboxPublisher;
use App\Apps\Relay\RelayServices\RelayDeviceService;

final class RealtimeOutboxPublishTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 1;
    }

    public function exec(): void
    {
        app(RelayDeviceService::class)->expirePresence();
        app(RealtimeOutboxPublisher::class)->publishPending();
    }
}
