<?php

namespace App\Services\TimerTasks;

use App\Services\WorkLeases\WorkLeaseService;

/**
 * Clears expired work leases on the gap rows (accounting only: a claim already
 * treats an expired lease as free; config/queue_center_contract.json work_leases).
 */
final class WorkLeaseReaperTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 60;

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function exec(): void
    {
        $cleared = app(WorkLeaseService::class)->reap();
        if ($cleared > 0) {
            $this->logInfo('expired work leases cleared', ['rows' => $cleared]);
        }
    }
}
