<?php

namespace App\Services\TimerTasks;

final class GlobalTaskResultWritebackTask extends TaskManagerTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 1;

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function exec(): void
    {
        $completed = $this->taskManager->finalizePendingResults();
        if ($completed > 0) {
            $this->logInfo('Result writebacks finalized', ['completed' => $completed]);
        }
    }
}
