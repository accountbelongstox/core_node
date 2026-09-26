<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\Services\AppQyV1LibraryCoverTaskService;
use App\Services\UserConfig\UserConfigService;

/**
 * AppQyV1 Library Cover Fallback Timer Task.
 *
 * Every 5s it first mirrors terminally failed cover tasks onto their library
 * rows (AppQyV1LibraryCoverTaskService::syncTerminalFailures), then hands at
 * most one pending cover task that no browser worker claimed in time to the
 * Laravel AI image gateway (runFallback). The fallback does nothing while no
 * image provider is configured or all of them are cooling down.
 */
class AppQyV1LibraryCoverFallbackTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 5;

    public function getName(): string
    {
        return 'appqyv1_library_cover_fallback';
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    /**
     * Gated by the user-data library cover fallback setting (default true).
     */
    public function isEnabled(): bool
    {
        return (bool) app(UserConfigService::class)->get(
            UserConfigService::APPQYV1_LIBRARY_COVER_FALLBACK_ENABLED,
            true
        );
    }

    public function exec(): void
    {
        $service = app(AppQyV1LibraryCoverTaskService::class);

        try {
            $synced = $service->syncTerminalFailures();
            if ($synced > 0) {
                $this->logInfo('Library cover rows marked failed from terminal cover tasks', ['synced' => $synced]);
            }
        } catch (\Throwable $e) {
            $this->logError('Library cover failure sync failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        try {
            $handled = $service->runFallback();
            if ($handled !== null) {
                $this->logInfo('Library cover task handled by Laravel AI fallback', $handled);
            }
        } catch (\Throwable $e) {
            $this->logError('Library cover fallback failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
