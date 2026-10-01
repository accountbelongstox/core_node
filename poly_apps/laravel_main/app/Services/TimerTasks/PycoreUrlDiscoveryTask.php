<?php

namespace App\Services\TimerTasks;

use App\CallPycoreUtils\PycoreHttpClient;

/**
 * Pending deletion (LARAVEL_GUIDE §1 pycore boundary: Laravel never calls
 * pycore). Disabled so the auto-discovered timer never probes pycore.
 */
class PycoreUrlDiscoveryTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 10;

    public function getName(): string
    {
        return 'pycore_url_discovery';
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        return false;
    }

    public function exec(): void
    {
        $baseUrl = PycoreHttpClient::refresh();

        $this->logDebug('pycore endpoint refreshed', ['base_url' => $baseUrl]);
    }
}
