<?php

namespace App\Services\TimerTasks;

use App\Providers\PathMapper;
use App\Helpers\PycoreCaller;

/**
 * Pycore URL Discovery Task
 *
 * Scans LAN for Pycore service and updates the service URL.
 * Only runs on WSL/Desktop environments.
 */
class PycoreUrlDiscoveryTask extends OctaneTimerTaskAbstract
{
    /**
     * @inheritDoc
     */
    public function getName(): string
    {
        return 'pycore_url_discovery';
    }

    /**
     * @inheritDoc
     */
    public function getInterval(): int
    {
        return 10; // Every 10 seconds
    }

    /**
     * @inheritDoc
     */
    public function exec(): void
    {
        try {
            // Check if running on WSL or Desktop
            $isWsl = PathMapper::isWSL();
            $hasDesktop = PathMapper::hasDesktopEnvironment();

            if (!$isWsl && !$hasDesktop) {
                // Production server, only check localhost
                $this->checkPycoreService('http://127.0.0.1:59000');
                return;
            }

            // WSL/Desktop: Scan LAN
            $url = $this->scanForPycoreService();
            if ($url !== null) {
                $this->logDebug('Service found', ['url' => $url]);
                PycoreCaller::setBaseUrl($url);
            }

        } catch (\Throwable $e) {
            $this->logError('Task failed', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Check if Pycore service is available at given URL
     *
     * @param string $url
     * @return bool
     */
    protected function checkPycoreService(string $url): bool
    {
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(2)
                ->get($url . '/health');

            if ($response->successful()) {
                $data = $response->json();
                return ($data['success'] ?? false) === true;
            }
        } catch (\Throwable $e) {
            // Silent fail
        }

        return false;
    }

    /**
     * Scan LAN for Pycore service
     *
     * @return string|null
     */
    protected function scanForPycoreService(): ?string
    {
        $defaultPort = 59000;

        // Priority 1: Check localhost
        $localhostUrl = "http://127.0.0.1:{$defaultPort}";
        if ($this->checkPycoreService($localhostUrl)) {
            return $localhostUrl;
        }

        // Priority 2: Get local IP and scan subnet
        $localIp = $this->getLocalIpAddress();
        if ($localIp === null) {
            return null;
        }

        $ipParts = explode('.', $localIp);
        if (count($ipParts) !== 4) {
            return null;
        }

        $subnet = "{$ipParts[0]}.{$ipParts[1]}.{$ipParts[2]}";

        // Scan priority IPs first
        $priorityHosts = [1, 2, 254, 253];
        foreach ($priorityHosts as $host) {
            $url = "http://{$subnet}.{$host}:{$defaultPort}";
            if ($this->checkPycoreService($url)) {
                return $url;
            }
        }

        return null;
    }

    /**
     * Get local IP address
     *
     * @return string|null
     */
    protected function getLocalIpAddress(): ?string
    {
        $output = [];
        $returnVar = 0;
        @exec('hostname -I 2>/dev/null', $output, $returnVar);

        if ($returnVar === 0 && !empty($output)) {
            $ips = preg_split('/\s+/', trim($output[0]));
            foreach ($ips as $ip) {
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && !str_starts_with($ip, '127.')) {
                    return $ip;
                }
            }
        }

        return null;
    }
}
