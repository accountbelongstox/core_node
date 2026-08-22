<?php

namespace App\Services\TimerTasks;

use App\Services\Realtime\RealtimeOutboxPublisher;

final class RealtimeOutboxPublishTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 1;
    }

    public function exec(): void
    {
        app(RealtimeOutboxPublisher::class)->publishPending();
    }
}
