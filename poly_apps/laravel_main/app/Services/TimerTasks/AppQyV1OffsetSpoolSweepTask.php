<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DurableOffsetUploadService;

/**
 * Removes offset-v1 upload spools whose transfer stopped (no chunk for a
 * day). Completed spools are dropped by their consumers right away.
 */
final class AppQyV1OffsetSpoolSweepTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 3600;
    private const ABANDONED_AFTER_SECONDS = 86400;

    public function getExecutionMode(): string
    {
        return self::EXECUTION_BACKGROUND;
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function exec(): void
    {
        $removed = app(AppQyV1DurableOffsetUploadService::class)->sweepAbandoned(self::ABANDONED_AFTER_SECONDS);
        if ($removed > 0) {
            $this->logInfo('Abandoned offset upload spools removed', ['removed' => $removed]);
        }
    }
}
