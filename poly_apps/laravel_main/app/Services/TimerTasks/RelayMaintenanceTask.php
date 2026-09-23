<?php

namespace App\Services\TimerTasks;

use App\Apps\Relay\RelayServices\RelayDeviceService;
use App\Apps\Relay\RelayServices\RelayMaintenanceService;
use App\Services\Realtime\RealtimeOutboxPublisher;

/**
 * Relay maintenance slice (30s). Also owns the relay duties of the
 * decommissioned realtime_outbox_publish_task (direct-emit refactor,
 * docs_fix/DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md): presence expiry and the
 * relay outbox drain. Queue-center/social event publication is event-driven
 * (published at emit time); relay device ops keep this bounded drain plus
 * their claim/operation polls as the reconciliation net.
 */
final class RelayMaintenanceTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 30;
    }

    public function exec(): void
    {
        app(RelayMaintenanceService::class)->runSlice();
        app(RelayDeviceService::class)->expirePresence();
        app(RealtimeOutboxPublisher::class)->publishRelay();
    }
}
