<?php

namespace App\Services\TimerTasks;

use App\Services\Realtime\RealtimeOutboxPublisher;

/**
 * 1s realtime outbox poller — DECOMMISSIONED (direct-emit refactor,
 * docs_fix/DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md): queue-center and social
 * events publish in the same request that appends them
 * (AppQyV1TranslationEventModel / AppQyV1SocialEventModel), and relay
 * presence expiry + outbox drain moved to RelayMaintenanceTask. This class
 * stays registered but disabled as an operator safety net that sweeps
 * unpublished outbox rows; enable only via the user-data setting when the
 * hub is unstable enough that direct publishes are being dropped.
 */
final class RealtimeOutboxPublishTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 1;
    }

    public function isEnabled(): bool
    {
        return (bool) app(\App\Services\UserConfig\UserConfigService::class)
            ->get('realtime_outbox_publish_poller', false);
    }

    public function exec(): void
    {
        app(RealtimeOutboxPublisher::class)->publishPending();
    }
}
