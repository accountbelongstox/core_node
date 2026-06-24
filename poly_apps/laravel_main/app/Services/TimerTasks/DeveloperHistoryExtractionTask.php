<?php

namespace App\Services\TimerTasks;

use App\Providers\PathMapper;
use App\Services\DeveloperHistory\DeveloperHistoryService;

/**
 * Developer History Extraction Task.
 *
 * Resident-process submodule: on Octane worker boot it detects whether this is a
 * developer machine and, if so, extracts AI-tool prompt/session history into the
 * JSON store ONCE, then caches that "constant" for the worker lifetime so later
 * ticks do no work. Disabled entirely on production servers.
 */
class DeveloperHistoryExtractionTask extends OctaneTimerTaskAbstract
{
    /** Per-worker run-once guard (survives every tick of this worker). */
    private static bool $done = false;

    /** Seconds within which another worker's run is treated as fresh enough. */
    private const COOLDOWN = 300;

    public function getName(): string
    {
        return 'developer_history_extraction';
    }

    public function getInterval(): int
    {
        return 30;
    }

    public function isEnabled(): bool
    {
        // Developer-only: never register on production servers.
        return PathMapper::hasDesktopEnvironment() || PathMapper::isWSL();
    }

    public function exec(): void
    {
        if (self::$done) {
            return;
        }
        self::$done = true;

        try {
            $stampFile = PathMapper::getLaravelTmpDir() . '/dev_history_last_run.txt';
            $lastRun = is_file($stampFile) ? (int) @file_get_contents($stampFile) : 0;
            $now = time();

            // Another worker on this boot already refreshed it — reuse that constant.
            if ($lastRun > 0 && ($now - $lastRun) < self::COOLDOWN) {
                $this->logDebug('Skip: extracted recently by another worker');
                return;
            }
            @file_put_contents($stampFile, (string) $now);

            $service = new DeveloperHistoryService();
            $result = $service->extract(false);
            $this->logInfo('Developer history extracted', $result);
        } catch (\Throwable $e) {
            $this->logError('Developer history extraction failed', ['error' => $e->getMessage()]);
        }
    }
}
