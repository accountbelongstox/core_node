<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;

/**
 * Standalone stale-TTS-lock reclaim (safety net).
 *
 * AppQyV1DictionaryTTSCoordinator::reapStaleLocks() previously ran ONLY inside
 * AppQyV1UnifiedTTSQueueService::processQueue() — i.e. it was coupled to the
 * cover/TTS queue tick. If that path stalls, is disabled, or errors, an assist
 * worker (pycore) that claimed words and then died/hung leaves those rows locked
 * ('processing', tts_locked_by='assist:...') and nothing reclaims them until the
 * lease window expires AND the queue path next runs. This independent 5-minute
 * timer is the decoupled safety net: it resets stale/expired locks back to
 * 'pending' on its own schedule (claimable predicate = 10-min local lock /
 * 60-min assist lease), regardless of the queue path's health.
 *
 * Idempotent + index-backed: an UPDATE that matches zero rows once nothing is
 * stale, so it costs almost nothing on a healthy system.
 */
class AppQyV1TtsLockReclaimTask extends OctaneTimerTaskAbstract
{
    // Run cadence (seconds). 5 minutes: well below the 60-min assist lease so a
    // hung worker's words are re-offered promptly, but cheap enough to ignore.
    public function getInterval(): int
    {
        return 300;
    }

    public function exec(): void
    {
        $reaped = (new AppQyV1DictionaryTTSCoordinator())->reapStaleLocks();
        if ($reaped > 0) {
            $this->logInfo('Reclaimed stale TTS locks', ['reaped' => $reaped]);
        }
    }
}
