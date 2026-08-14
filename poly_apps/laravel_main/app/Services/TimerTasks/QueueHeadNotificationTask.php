<?php

namespace App\Services\TimerTasks;

use App\Services\QueueCenter\QueueHeadNotificationService;
use App\Support\QueueCenterContract;

final class QueueHeadNotificationTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return max(
            1,
            (int) (QueueCenterContract::diffDelivery()['head_notification_interval_seconds'] ?? 2)
        );
    }

    public function exec(): void
    {
        app(QueueHeadNotificationService::class)->flush();
    }
}
