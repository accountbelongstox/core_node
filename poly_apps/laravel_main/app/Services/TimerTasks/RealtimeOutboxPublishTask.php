<?php

namespace App\Services\TimerTasks;

use App\Services\Realtime\RealtimeOutboxPublisher;
use Laravel\Octane\Facades\Octane;

final class RealtimeOutboxPublishTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 1;
    }

    public function exec(): void
    {
        Octane::concurrently([
            static fn (): array => app(RealtimeOutboxPublisher::class)->publishPending(),
        ], 30000);
    }
}
