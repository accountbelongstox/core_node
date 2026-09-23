<?php

namespace App\Services\TimerTasks;

use App\Services\QueueCenter\QueueHeadNotificationService;
use App\Support\QueueCenterContract;

/**
 * 2s head-notification poller — DECOMMISSIONED (direct-emit refactor,
 * docs_fix/DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md):
 * QueueHeadNotificationService::record() emits the {queue}_head event in the
 * same request that moves the head. This class stays registered but disabled
 * as an operator safety net (its flush() sweeps any revision a failed direct
 * emit left behind); enable only via the user-data setting when the hub is
 * unstable enough that direct emits are being dropped.
 */
final class QueueHeadNotificationTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return max(
            1,
            (int) (QueueCenterContract::diffDelivery()['head_notification_interval_seconds'] ?? 2)
        );
    }

    public function isEnabled(): bool
    {
        return (bool) app(\App\Services\UserConfig\UserConfigService::class)
            ->get('queue_center_head_notification_poller', false);
    }

    public function exec(): void
    {
        app(QueueHeadNotificationService::class)->flush();
    }
}
