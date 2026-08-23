<?php

namespace App\Providers;

use App\Support\ServiceContract;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * PycoreUrlFinder - Auto-discover Pycore Module Caller service URL
 *
 * Automatically finds Pycore service by scanning LAN when running on WSL or Desktop.
 * Provides discovered URL to PycoreCaller.
 *
 * Priority:
 * 1. Check the service-contract loopback endpoint
 * 2. If WSL/Desktop: scan LAN IP segment
 * 3. Cache successful results
 */
class PycoreUrlFinder
{
    /**
     * Default Pycore service port
     */
    protected static ?int $defaultPort = null;

    protected static function defaultPort(): int
    {
        return self::$defaultPort ?? ServiceContract::port('pycore_backend');
    }

    /**
     * Timeout for health check requests (in seconds)
     */
    protected static int $healthCheckTimeout = 2;

    /**
     * Cache TTL for discovered URL (in seconds)
     * Short TTL for dynamic switching
     */
    protected static int $cacheTTL = 30; // 30 seconds - allow quick switching

    /**
     * Cache key for discovered URL
     */
    protected static string $cacheKey = 'pycore_service_url';

    /**
     * Last scan timestamp
     */
    protected static ?int $lastScanTime = null;

    /**
     * Minimum interval between scans (in seconds)
     */
    protected static int $scanInterval = 10; // Scan every 10 seconds max

    /**
     * Find Pycore service URL with dynamic switching
     *
     * @param bool $forceRefresh Force refresh without cache
     * @return string|null Service URL or null if not found
     */
    public static function findServiceUrl(bool $forceRefresh = false): ?string
    {
        $now = time();

        // Check cache first (unless force refresh)
        if (!$forceRefresh) {
            $cachedUrl = Cache::get(self::$cacheKey);

            // Verify cached URL is still healthy
            if ($cachedUrl !== null) {
                // Only verify if enough time has passed since last scan
                if (self::$lastScanTime === null || ($now - self::$lastScanTime) >= self::$scanInterval) {
                    if (self::checkServiceHealth($cachedUrl)) {
                        // Reduce logging - only log at debug level
                        self::$lastScanTime = $now;
                        return $cachedUrl;
                    } else {
                        // Cached URL is dead, clear cache and rescan
                        Log::warning('PycoreUrlFinder: Cached URL unhealthy, rescanning', ['url' => $cachedUrl]);
                        Cache::forget(self::$cacheKey);
                    }
                } else {
                    // Trust cache without checking (within scan interval)
                    return $cachedUrl;
                }
            }
        }

        // Update last scan time
        self::$lastScanTime = $now;

        // Priority 1: Check localhost
        $localhostUrl = 'http://'.ServiceContract::host('loopback').':'.self::defaultPort();
        if (self::checkServiceHealth($localhostUrl)) {
            Log::info('PycoreUrlFinder: Service found on localhost', ['url' => $localhostUrl]);
            Cache::put(self::$cacheKey, $localhostUrl, self::$cacheTTL);
            return $localhostUrl;
        }

        // Priority 2: If WSL or Desktop, scan LAN
        $isWsl = PathMapper::isWSL();
        $hasDesktop = PathMapper::hasDesktopEnvironment();

        if ($isWsl || $hasDesktop) {
            $environment = $isWsl ? 'WSL' : 'Desktop';
            Log::info("PycoreUrlFinder: Running on {$environment}, scanning LAN for Pycore service");

            $lanUrl = self::scanLanForService();
            if ($lanUrl !== null) {
                Log::info('PycoreUrlFinder: Service found on LAN', ['url' => $lanUrl]);
                Cache::put(self::$cacheKey, $lanUrl, self::$cacheTTL);
                return $lanUrl;
            }
        }

        // Not found
        Log::warning('PycoreUrlFinder: Pycore service not found');
        return null;
    }

    /**
     * Scan LAN IP segment for Pycore service
     *
     * @return string|null Service URL or null if not found
     */
    protected static function scanLanForService(): ?string
    {
        $localIp = self::getLocalIpAddress();
        if ($localIp === null) {
            Log::warning('PycoreUrlFinder: Could not determine local IP address');
            return null;
        }

        Log::debug('PycoreUrlFinder: Local IP address', ['ip' => $localIp]);

        // Extract subnet (assume /24)
        $ipParts = explode('.', $localIp);
        if (count($ipParts) !== 4) {
            Log::warning('PycoreUrlFinder: Invalid IP address format', ['ip' => $localIp]);
            return null;
        }

        $subnet = "{$ipParts[0]}.{$ipParts[1]}.{$ipParts[2]}";
        Log::info('PycoreUrlFinder: Scanning subnet', ['subnet' => "{$subnet}.0/24"]);

        // Scan common IPs first (gateway, .1, .2, etc.)
        $priorityHosts = [1, 2, 254, 253];
        foreach ($priorityHosts as $host) {
            $ip = "{$subnet}.{$host}";
            $url = "http://{$ip}:".self::defaultPort();

            if (self::checkServiceHealth($url)) {
                Log::info('PycoreUrlFinder: Service found', ['url' => $url]);
                return $url;
            }
        }

        // Full subnet scan (skip localhost and already checked)
        $currentHost = (int)$ipParts[3];
        $checkedHosts = array_merge([0, 255, $currentHost], $priorityHosts);

        for ($i = 1; $i <= 254; $i++) {
            if (in_array($i, $checkedHosts)) {
                continue;
            }

            $ip = "{$subnet}.{$i}";
            $url = "http://{$ip}:".self::defaultPort();

            if (self::checkServiceHealth($url)) {
                Log::info('PycoreUrlFinder: Service found', ['url' => $url]);
                return $url;
            }
        }

        Log::warning('PycoreUrlFinder: No service found in subnet', ['subnet' => "{$subnet}.0/24"]);
        return null;
    }

    /**
     * Check if Pycore service is healthy at given URL
     *
     * @param string $url Base URL to check
     * @return bool True if service is healthy
     */
    protected static function checkServiceHealth(string $url): bool
    {
        try {
            $response = Http::timeout(self::$healthCheckTimeout)
                ->retry(1, 100)
                ->get($url . '/health');

            if ($response->successful()) {
                $data = $response->json();
                return ($data['success'] ?? false) === true;
            }

            return false;
        } catch (\Exception $e) {
            // Silent fail for network errors during scan
            return false;
        }
    }

    /**
     * Get local IP address
     *
     * @return string|null Local IP address or null if not found
     */
    protected static function getLocalIpAddress(): ?string
    {
        // Method 1: Use hostname command
        $output = [];
        $returnVar = 0;
        @exec('hostname -I 2>/dev/null', $output, $returnVar);

        if ($returnVar === 0 && !empty($output)) {
            $ips = preg_split('/\s+/', trim($output[0]));
            foreach ($ips as $ip) {
                // Skip IPv6 and loopback
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && !str_starts_with($ip, '127.')) {
                    return $ip;
                }
            }
        }

        // Method 2: Parse ip addr command
        $output = [];
        $returnVar = 0;
        @exec('ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | head -n 1', $output, $returnVar);

        if ($returnVar === 0 && !empty($output)) {
            if (preg_match('/inet\s+(\d+\.\d+\.\d+\.\d+)/', $output[0], $matches)) {
                return $matches[1];
            }
        }

        // Method 3: Use $_SERVER (for web requests)
        if (isset($_SERVER['SERVER_ADDR']) && $_SERVER['SERVER_ADDR'] !== '127.0.0.1') {
            return $_SERVER['SERVER_ADDR'];
        }

        return null;
    }

    /**
     * Get current service URL (from cache or find new)
     *
     * @return string Service URL (defaults to localhost if not found)
     */
    public static function getServiceUrl(): string
    {
        $url = self::findServiceUrl();
        return $url ?? 'http://'.ServiceContract::host('loopback').':'.self::defaultPort();
    }

    /**
     * Clear cached service URL
     *
     * @return void
     */
    public static function clearCache(): void
    {
        Cache::forget(self::$cacheKey);
        Log::info('PycoreUrlFinder: Cache cleared');
    }

    /**
     * Set custom port for Pycore service
     *
     * @param int $port Port number
     * @return void
     */
    public static function setPort(int $port): void
    {
        self::$defaultPort = $port;
        self::clearCache();
    }

    /**
     * Get service diagnostics
     *
     * @return array Diagnostic information
     */
    public static function getDiagnostics(): array
    {
        $isWsl = PathMapper::isWSL();
        $hasDesktop = PathMapper::hasDesktopEnvironment();
        $localIp = self::getLocalIpAddress();
        $cachedUrl = Cache::get(self::$cacheKey);
        $currentUrl = self::findServiceUrl(forceRefresh: true);

        return [
            'environment' => [
                'is_wsl' => $isWsl,
                'has_desktop' => $hasDesktop,
                'local_ip' => $localIp,
                'should_scan_lan' => $isWsl || $hasDesktop,
            ],
            'service' => [
                'port' => self::defaultPort(),
                'cached_url' => $cachedUrl,
                'current_url' => $currentUrl,
                'is_available' => $currentUrl !== null,
            ],
            'localhost_check' => [
                'url' => 'http://'.ServiceContract::host('loopback').':'.self::defaultPort(),
                'available' => self::checkServiceHealth('http://'.ServiceContract::host('loopback').':'.self::defaultPort()),
            ],
        ];
    }

    /**
     * Test LAN scanning (for debugging)
     *
     * @return array Scan results
     */
    public static function testLanScan(): array
    {
        $localIp = self::getLocalIpAddress();
        if ($localIp === null) {
            return [
                'success' => false,
                'error' => 'Could not determine local IP address'
            ];
        }

        $ipParts = explode('.', $localIp);
        $subnet = "{$ipParts[0]}.{$ipParts[1]}.{$ipParts[2]}";

        $results = [
            'success' => true,
            'local_ip' => $localIp,
            'subnet' => "{$subnet}.0/24",
            'scanned_ips' => [],
        ];

        // Test first 10 IPs only
        for ($i = 1; $i <= 10; $i++) {
            $ip = "{$subnet}.{$i}";
            $url = "http://{$ip}:".self::defaultPort();
            $available = self::checkServiceHealth($url);

            $results['scanned_ips'][$ip] = [
                'url' => $url,
                'available' => $available,
            ];

            if ($available) {
                $results['found_url'] = $url;
                break;
            }
        }

        return $results;
    }
}
