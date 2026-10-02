<?php

namespace App\Services\TimerTasks;

use App\Services\WorkLeases\WorkLeaseService;
use App\Support\SchemaGate;

/**
 * Clears expired work leases on the gap rows (accounting only: a claim already
 * treats an expired lease as free) and runs the paced failed-row resurfacing
 * slice (config/queue_center_contract.json work_leases).
 */
final class WorkLeaseReaperTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 60;

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        return SchemaGate::allowsTimer($this->getName());
    }

    public function exec(): void
    {
        $leases = app(WorkLeaseService::class);
        $cleared = $leases->reap();
        if ($cleared > 0) {
            $this->logInfo('expired work leases cleared', ['rows' => $cleared]);
        }
        foreach ($leases->resurface() as $sweep) {
            $this->logInfo('failed resurfacing sweep finished', $sweep);
        }
    }
}
