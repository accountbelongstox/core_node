<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AgentHistoryAudioWritebackService;
use App\Services\DataSync\DataSyncStateStore;

final class AppQyV1AgentHistoryAudioWritebackTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 10;

    private const RECOVERY_AGE_SECONDS = 30;

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        // Writeback runs 80-110s per pass and would stall the shared serial
        // heartbeat while a data synchronization session is active.
        return !app(DataSyncStateStore::class)->hasActiveSession();
    }

    public function exec(): void
    {
        $completed = app(AppQyV1AgentHistoryAudioWritebackService::class)->recoverPending(
            1,
            self::RECOVERY_AGE_SECONDS
        );
        if ($completed > 0) {
            $this->logInfo('Agent history audio writeback recovered', [
                'completed' => $completed,
            ]);
        }
    }
}
