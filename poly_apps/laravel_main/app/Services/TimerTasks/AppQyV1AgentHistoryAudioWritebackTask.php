<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AgentHistoryAudioWritebackService;

final class AppQyV1AgentHistoryAudioWritebackTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 10;

    private const RECOVERY_AGE_SECONDS = 30;

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
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
