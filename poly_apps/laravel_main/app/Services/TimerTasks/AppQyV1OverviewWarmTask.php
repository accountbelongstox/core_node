<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;

/**
 * Keep the Queue Center assist overview snapshot warm in the shared cache.
 *
 * The overview aggregates many COUNT queries across global_tasks and every
 * per-language dictionary/sentence table. Computing it inside an HTTP request
 * can exceed the pycore/UI caller's 8-second timeout, especially when several
 * clients ask at the same time. By warming the snapshot every 20 seconds on
 * the Octane timer, the GET /api/app_qy_v1/assist/overview handler always
 * returns a cached value instantly and never blocks a worker.
 */
class AppQyV1OverviewWarmTask extends OctaneTimerTaskAbstract
{
    public function getInterval(): int
    {
        return 20;
    }

    public function exec(): void
    {
        $service = new AppQyV1AssistService();

        try {
            $startedAt = microtime(true);
            // Force a synchronous rebuild + store. Cache::flexible's deferred
            // refresh never runs inside an Octane tick (deferred callbacks
            // only execute for HTTP responses, Artisan commands and queued
            // jobs), so the warm path must not rely on it.
            $service->warmOverviewSnapshot();
            $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
            if ($elapsedMs >= 1000) {
                $this->logWarning('Overview snapshot warm exceeded budget', ['duration_ms' => $elapsedMs]);
            }
        } catch (\Throwable $e) {
            $this->logWarning('Overview warm failed', ['error' => $e->getMessage()]);
        }

        // The pending snapshot (/assist/pending, /assist/status) follows the
        // same contract: published here, pure cache reads on HTTP workers.
        try {
            $service->warmPendingSnapshot();
        } catch (\Throwable $e) {
            $this->logWarning('Pending snapshot warm failed', ['error' => $e->getMessage()]);
        }
    }
}
