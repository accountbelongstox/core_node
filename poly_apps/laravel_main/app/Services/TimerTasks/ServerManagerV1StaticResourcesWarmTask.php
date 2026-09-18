<?php

namespace App\Services\TimerTasks;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1StaticResourceAnalyzer;

/**
 * Keep the ServerManagerV1 static-resources summary warm in the shared cache.
 *
 * The summary scans 100k+ files under laravel_db/static (counts, sizes by
 * type, per-subdirectory breakdown). Serving it from the HTTP path blocked
 * an Octane worker for ~90s on every cache expiry, freezing the dashboard
 * for everyone. The HTTP handler now only reads the cached snapshot and
 * flags it 'stale'; this task re-scans on the Octane timer once the snapshot
 * is older than the stale threshold, so requests always return instantly.
 */
class ServerManagerV1StaticResourcesWarmTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 60;
    }

    public function exec(): void
    {
        try {
            $refreshed = (new ServerManagerV1StaticResourceAnalyzer())->refreshIfStale();
            if ($refreshed) {
                $this->logInfo('Static resources summary refreshed');
            }
        } catch (\Throwable $e) {
            $this->logWarning('Static resources warm failed', ['error' => $e->getMessage()]);
        }
    }
}
