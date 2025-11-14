<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;

/**
 * Octane Service Manager for ServerManagerV1
 *
 * IMPORTANT SYNCHRONIZATION NOTE:
 * This class must maintain consistency with:
 * /www/programing/core_node/scripts/shells/linux/common/octane_service_manager.sh
 *
 * When modifying this file, ensure corresponding changes are made to the shell script.
 * When modifying the shell script, ensure corresponding changes are made to this file.
 *
 * Service naming convention: octane-<path_hash>-<port>
 * - Path-based: One service per directory path, shared by multiple domains
 * - Different from PHP-FPM: FPM is per-domain, Swoole is per-path (reverse proxy to multiple domains)
 * Auto-restart: Every 48 hours via systemd timer
 *
 * USER CONTEXT:
 * - CLI commands (artisan): Default user is 'root' (run via sudo)
 * - Web API calls: Default user is 'www-data' (current web user)
 */
class ServerManagerV1OctaneServiceManager
{
    private const OCTANE_SERVICE_PREFIX = 'octane-';
    private const SYSTEMD_DIR = '/etc/systemd/system';
    private const RESTART_INTERVAL = '48h';
    // SYNC: octane_service_manager.sh - Port range 9000-9999 (less commonly used)
    private const SWOOLE_PORT_START = 9000;
    private const SWOOLE_PORT_END = 9999;

    /**
     * Determine service user based on execution context
     */
    public static function getDefaultServiceUser(): string
    {
        // Check if running from CLI (artisan command)
        if (php_sapi_name() === 'cli') {
            return 'root'; // CLI commands use root
        }

        // Running from web context (API)
        return 'www-data'; // Web API uses www-data
    }

    /**
     * Generate path hash for service naming
     * Uses first 8 chars of MD5 hash of the directory path
     */
    public static function getPathHash(string $wwwDir): string
    {
        return substr(md5($wwwDir), 0, 8);
    }

    /**
     * Get Octane service name from path and port (PATH-BASED - RECOMMENDED)
     * Service is per-directory, not per-domain
     * Multiple domains in same directory share the same service
     */
    public static function getOctaneServiceNameFromPath(string $wwwDir, int $port): string
    {
        $pathHash = self::getPathHash($wwwDir);
        return self::OCTANE_SERVICE_PREFIX . $pathHash . '-' . $port;
    }

    /**
     * Get Octane service name from domain and port (LEGACY - DOMAIN-BASED)
     * @deprecated Use getOctaneServiceNameFromPath() instead for path-based services
     * SYNC: octane_service_manager.sh:get_octane_service_name()
     */
    public static function getOctaneServiceName(string $domain, int $port): string
    {
        $sanitizedDomain = str_replace('.', '-', $domain);
        return self::OCTANE_SERVICE_PREFIX . $sanitizedDomain . '-' . $port;
    }

    /**
     * List all Octane services
     * SYNC: octane_service_manager.sh:list_octane_services()
     */
    public static function listOctaneServices(): array
    {
        $result = Process::run('systemctl list-units --type=service --all | grep "^  ' . self::OCTANE_SERVICE_PREFIX . '"');

        if (!$result->successful()) {
            return [];
        }

        $services = [];
        $lines = explode("\n", trim($result->output()));

        foreach ($lines as $line) {
            if (preg_match('/^\s*(' . self::OCTANE_SERVICE_PREFIX . '[^\s]+)\.service/', $line, $matches)) {
                $services[] = $matches[1];
            }
        }

        return $services;
    }

    /**
     * Calculate deterministic port from path hash
     * Same directory path always gets the same port number
     * This ensures one service per directory (shared by multiple domains)
     */
    public static function getPortFromPathHash(string $wwwDir): int
    {
        $pathHash = self::getPathHash($wwwDir);
        // Convert first 4 chars of hash to number
        $hashNum = hexdec(substr($pathHash, 0, 4));
        // Map to port range 9000-9999 (1000 ports available)
        $port = self::SWOOLE_PORT_START + ($hashNum % (self::SWOOLE_PORT_END - self::SWOOLE_PORT_START + 1));

        Log::debug('Calculated port from path hash', [
            'www_dir' => $wwwDir,
            'path_hash' => $pathHash,
            'hash_num' => $hashNum,
            'port' => $port
        ]);

        return $port;
    }

    /**
     * Find existing service for a given path
     * Returns service info if found, null otherwise
     */
    public static function findExistingServiceForPath(string $wwwDir): ?array
    {
        $pathHash = self::getPathHash($wwwDir);
        $services = self::listOctaneServices();

        foreach ($services as $service) {
            // Check if service name contains the path hash
            // Service naming: octane-<path_hash>-<port>
            if (strpos($service, self::OCTANE_SERVICE_PREFIX . $pathHash . '-') === 0) {
                // Extract port from service name
                if (preg_match('/(\d+)$/', $service, $matches)) {
                    Log::info('Found existing service for path', [
                        'www_dir' => $wwwDir,
                        'path_hash' => $pathHash,
                        'service_name' => $service,
                        'port' => (int)$matches[1]
                    ]);

                    return [
                        'service_name' => $service,
                        'port' => (int)$matches[1],
                        'path_hash' => $pathHash
                    ];
                }
            }
        }

        Log::debug('No existing service found for path', [
            'www_dir' => $wwwDir,
            'path_hash' => $pathHash
        ]);

        return null;
    }

    /**
     * Get next available port for Swoole service
     * SYNC: octane_service_manager.sh:get_next_available_port()
     * @deprecated Use getPortFromPathHash() for path-based services
     */
    public static function getNextAvailablePort(): int
    {
        $usedPorts = [];

        // Get all existing Octane services and extract their ports
        $services = self::listOctaneServices();

        foreach ($services as $service) {
            // Extract port from service name: octane-domain-com-9000 -> 9000
            if (preg_match('/(\d+)$/', $service, $matches)) {
                $usedPorts[] = (int)$matches[1];
            }
        }

        // Find first available port in range
        for ($port = self::SWOOLE_PORT_START; $port <= self::SWOOLE_PORT_END; $port++) {
            if (in_array($port, $usedPorts)) {
                continue;
            }

            // Double-check port is not in use by other services
            $result = Process::run("ss -tuln | grep ':$port '");
            if (!$result->successful()) {
                // Port is free
                return $port;
            }
        }

        // Fallback to start port if all are used
        Log::warning('All ports in range are used, returning start port', [
            'start' => self::SWOOLE_PORT_START,
            'end' => self::SWOOLE_PORT_END
        ]);

        return self::SWOOLE_PORT_START;
    }

    /**
     * Create Octane service (PATH-BASED)
     * SYNC: octane_service_manager.sh:create_octane_service()
     *
     * @param string $wwwDir Directory path (used for service naming)
     * @param int|null $port Port number (auto-assigned if null)
     * @param int $workers Number of workers
     * @param string|null $laravelPath Path to Laravel installation (defaults to $wwwDir)
     * @param string|null $serviceUser Service user (defaults based on context)
     * @param string|null $serviceGroup Service group (defaults to $serviceUser)
     * @param string|null $description Optional description (e.g., list of domains using this service)
     */
    public static function createOctaneServiceFromPath(
        string $wwwDir,
        ?int $port = null,
        int $workers = 4,
        ?string $laravelPath = null,
        ?string $serviceUser = null,
        ?string $serviceGroup = null,
        ?string $description = null
    ): bool {
        // Auto-assign port if not provided
        if ($port === null) {
            $port = self::getNextAvailablePort();
            Log::info('Auto-assigned port', ['www_dir' => $wwwDir, 'port' => $port]);
        }

        if ($laravelPath === null) {
            $laravelPath = $wwwDir;
        }

        if (!is_dir($laravelPath)) {
            Log::error('Laravel path not found', ['path' => $laravelPath]);
            return false;
        }

        // Determine service user based on context if not specified
        if ($serviceUser === null) {
            $serviceUser = self::getDefaultServiceUser();
        }

        if ($serviceGroup === null) {
            $serviceGroup = $serviceUser;
        }

        $serviceName = self::getOctaneServiceNameFromPath($wwwDir, $port);
        $serviceFile = self::SYSTEMD_DIR . '/' . $serviceName . '.service';
        $timerFile = self::SYSTEMD_DIR . '/' . $serviceName . '.timer';

        $pathHash = self::getPathHash($wwwDir);

        Log::info('Creating Octane service (path-based)', [
            'service_name' => $serviceName,
            'www_dir' => $wwwDir,
            'path_hash' => $pathHash,
            'port' => $port,
            'workers' => $workers,
            'user' => $serviceUser . ':' . $serviceGroup,
            'laravel_path' => $laravelPath,
            'description' => $description
        ]);

        $serviceContent = self::generateServiceFileContentFromPath(
            $wwwDir,
            $port,
            $workers,
            $laravelPath,
            $serviceName,
            $serviceUser,
            $serviceGroup,
            $description
        );
        $timerContent = self::generateTimerFileContent($serviceName);

        if (file_put_contents($serviceFile, $serviceContent) === false) {
            Log::error('Failed to write service file', ['file' => $serviceFile]);
            return false;
        }

        if (file_put_contents($timerFile, $timerContent) === false) {
            Log::error('Failed to write timer file', ['file' => $timerFile]);
            return false;
        }

        chmod($serviceFile, 0644);
        chmod($timerFile, 0644);

        $result = Process::run('systemctl daemon-reload');

        if (!$result->successful()) {
            Log::error('Failed to reload systemd daemon');
            return false;
        }

        Log::info('Service files created', [
            'service' => $serviceFile,
            'timer' => $timerFile
        ]);

        return true;
    }

    /**
     * Create Octane service (LEGACY - DOMAIN-BASED)
     * @deprecated Use createOctaneServiceFromPath() instead
     * SYNC: octane_service_manager.sh:create_octane_service()
     */
    public static function createOctaneService(
        string $domain,
        ?int $port = null,
        int $workers = 4,
        ?string $laravelPath = null,
        ?string $serviceUser = null,
        ?string $serviceGroup = null
    ): bool {
        // Auto-assign port if not provided
        if ($port === null) {
            $port = self::getNextAvailablePort();
            Log::info('Auto-assigned port', ['domain' => $domain, 'port' => $port]);
        }

        if ($laravelPath === null) {
            $laravelPath = base_path();
        }

        if (!is_dir($laravelPath)) {
            Log::error('Laravel path not found', ['path' => $laravelPath]);
            return false;
        }

        // Determine service user based on context if not specified
        if ($serviceUser === null) {
            $serviceUser = self::getDefaultServiceUser();
        }

        if ($serviceGroup === null) {
            $serviceGroup = $serviceUser;
        }

        $serviceName = self::getOctaneServiceName($domain, $port);
        $serviceFile = self::SYSTEMD_DIR . '/' . $serviceName . '.service';
        $timerFile = self::SYSTEMD_DIR . '/' . $serviceName . '.timer';

        Log::info('Creating Octane service', [
            'service_name' => $serviceName,
            'domain' => $domain,
            'port' => $port,
            'workers' => $workers,
            'user' => $serviceUser . ':' . $serviceGroup,
            'laravel_path' => $laravelPath
        ]);

        $serviceContent = self::generateServiceFileContent(
            $domain,
            $port,
            $workers,
            $laravelPath,
            $serviceName,
            $serviceUser,
            $serviceGroup
        );
        $timerContent = self::generateTimerFileContent($serviceName);

        if (file_put_contents($serviceFile, $serviceContent) === false) {
            Log::error('Failed to write service file', ['file' => $serviceFile]);
            return false;
        }

        if (file_put_contents($timerFile, $timerContent) === false) {
            Log::error('Failed to write timer file', ['file' => $timerFile]);
            return false;
        }

        chmod($serviceFile, 0644);
        chmod($timerFile, 0644);

        $result = Process::run('systemctl daemon-reload');

        if (!$result->successful()) {
            Log::error('Failed to reload systemd daemon');
            return false;
        }

        Log::info('Service files created', [
            'service' => $serviceFile,
            'timer' => $timerFile
        ]);

        return true;
    }

    /**
     * Generate systemd service file content (PATH-BASED)
     * SYNC: octane_service_manager.sh:create_octane_service() cat > service_file
     *
     * Features:
     * - Auto-restart on failure
     * - Memory limit: 20% of total system memory per service
     * - 48-hour auto-restart via timer (prevents memory leaks)
     * - Configurable service user (default: root for CLI, www-data for API)
     * - Path-based naming: One service per directory, shared by multiple domains
     */
    private static function generateServiceFileContentFromPath(
        string $wwwDir,
        int $port,
        int $workers,
        string $laravelPath,
        string $serviceName,
        string $serviceUser,
        string $serviceGroup,
        ?string $description = null
    ): string {
        // Calculate 20% of system memory
        $memInfo = file_get_contents('/proc/meminfo');
        preg_match('/MemTotal:\s+(\d+)\s+kB/', $memInfo, $matches);
        $totalMemoryKB = isset($matches[1]) ? (int)$matches[1] : 8000000; // Fallback 8GB
        $memoryLimitKB = (int)($totalMemoryKB * 0.2); // 20% of total memory
        $memoryLimitMB = (int)($memoryLimitKB / 1024);

        $pathHash = self::getPathHash($wwwDir);
        $descLine = $description ? " ($description)" : '';

        // Get external directories that need write access (sessions, temp files, etc.)
        $externalPaths = self::getExternalWritePaths($laravelPath);
        $readWritePaths = "{$laravelPath}/storage {$laravelPath}/bootstrap/cache " . implode(' ', $externalPaths);

        return <<<EOF
[Unit]
Description=Laravel Octane Server for path {$pathHash} on port {$port}{$descLine}
After=network.target mysql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User={$serviceUser}
Group={$serviceGroup}
WorkingDirectory={$laravelPath}
ExecStart=/usr/bin/php {$laravelPath}/artisan octane:start --host=127.0.0.1 --port={$port} --workers={$workers}
ExecReload=/bin/kill -USR1 \$MAINPID

# Auto-restart configuration
Restart=always
RestartSec=10

# Memory limit: 20% of system memory (~{$memoryLimitMB}MB)
MemoryMax={$memoryLimitKB}K
MemoryHigh={$memoryLimitKB}K

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier={$serviceName}

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Security
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={$readWritePaths}

[Install]
WantedBy=multi-user.target
EOF;
    }

    /**
     * Get external paths that need write access for Laravel operations
     * Returns paths like session directories, temp directories managed by PathMapper
     */
    private static function getExternalWritePaths(string $laravelPath): array
    {
        $sessionDir = PathMapper::getLaravelSessionsDir();
        $laravel_db = dirname($sessionDir);

        Log::info('Added external write path for sessions', [
            'path' => $laravel_db,
            'session_dir' => $sessionDir
        ]);

        return [$laravel_db];
    }

    /**
     * Generate systemd service file content (LEGACY - DOMAIN-BASED)
     * @deprecated Use generateServiceFileContentFromPath() instead
     * SYNC: octane_service_manager.sh:create_octane_service() cat > service_file
     *
     * Features:
     * - Auto-restart on failure
     * - Memory limit: 20% of total system memory per service
     * - 48-hour auto-restart via timer (prevents memory leaks)
     * - Configurable service user (default: root for CLI, www-data for API)
     */
    private static function generateServiceFileContent(
        string $domain,
        int $port,
        int $workers,
        string $laravelPath,
        string $serviceName,
        string $serviceUser,
        string $serviceGroup
    ): string {
        // Calculate 20% of system memory
        $memInfo = file_get_contents('/proc/meminfo');
        preg_match('/MemTotal:\s+(\d+)\s+kB/', $memInfo, $matches);
        $totalMemoryKB = isset($matches[1]) ? (int)$matches[1] : 8000000; // Fallback 8GB
        $memoryLimitKB = (int)($totalMemoryKB * 0.2); // 20% of total memory
        $memoryLimitMB = (int)($memoryLimitKB / 1024);

        return <<<EOF
[Unit]
Description=Laravel Octane Server for {$domain} on port {$port}
After=network.target mysql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User={$serviceUser}
Group={$serviceGroup}
WorkingDirectory={$laravelPath}
ExecStart=/usr/bin/php {$laravelPath}/artisan octane:start --host=127.0.0.1 --port={$port} --workers={$workers}
ExecReload=/bin/kill -USR1 \$MAINPID

# Auto-restart configuration
Restart=always
RestartSec=10

# Memory limit: 20% of system memory (~{$memoryLimitMB}MB)
MemoryMax={$memoryLimitKB}K
MemoryHigh={$memoryLimitKB}K

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier={$serviceName}

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Security
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={$laravelPath}/storage {$laravelPath}/bootstrap/cache

[Install]
WantedBy=multi-user.target
EOF;
    }

    /**
     * Generate systemd timer file content
     * SYNC: octane_service_manager.sh:create_octane_service() cat > timer_file
     */
    private static function generateTimerFileContent(string $serviceName): string
    {
        return <<<EOF
[Unit]
Description=Auto-restart {$serviceName} every 48 hours
Requires={$serviceName}.service

[Timer]
OnBootSec=48h
OnUnitActiveSec=48h
Persistent=true

[Install]
WantedBy=timers.target
EOF;
    }

    /**
     * Start Octane service
     * SYNC: octane_service_manager.sh:start_octane_service()
     */
    public static function startOctaneService(string $serviceName): bool
    {
        Log::info('Starting Octane service', ['service' => $serviceName]);

        $result = Process::run("systemctl start {$serviceName}");

        if (!$result->successful()) {
            Log::error('Failed to start service', [
                'service' => $serviceName,
                'output' => $result->output()
            ]);
            return false;
        }

        Process::run("systemctl enable {$serviceName}");

        $timerResult = Process::run("systemctl start {$serviceName}.timer");
        if ($timerResult->successful()) {
            Process::run("systemctl enable {$serviceName}.timer");
            Log::info('Service started with 48h auto-restart', ['service' => $serviceName]);
        } else {
            Log::info('Service started (no timer)', ['service' => $serviceName]);
        }

        return true;
    }

    /**
     * Stop Octane service
     * SYNC: octane_service_manager.sh:stop_octane_service()
     */
    public static function stopOctaneService(string $serviceName): bool
    {
        Log::info('Stopping Octane service', ['service' => $serviceName]);

        Process::run("systemctl stop {$serviceName}.timer");
        Process::run("systemctl disable {$serviceName}.timer");

        $result = Process::run("systemctl stop {$serviceName}");

        if (!$result->successful()) {
            Log::error('Failed to stop service', ['service' => $serviceName]);
            return false;
        }

        Process::run("systemctl disable {$serviceName}");

        Log::info('Service stopped', ['service' => $serviceName]);
        return true;
    }

    /**
     * Restart Octane service
     * SYNC: octane_service_manager.sh:restart_octane_service()
     */
    public static function restartOctaneService(string $serviceName): bool
    {
        Log::info('Restarting Octane service', ['service' => $serviceName]);

        $result = Process::run("systemctl restart {$serviceName}");

        if (!$result->successful()) {
            Log::error('Failed to restart service', ['service' => $serviceName]);
            return false;
        }

        Log::info('Service restarted', ['service' => $serviceName]);
        return true;
    }

    /**
     * Remove Octane service
     * SYNC: octane_service_manager.sh:remove_octane_service()
     */
    public static function removeOctaneService(string $serviceName): bool
    {
        Log::info('Removing Octane service', ['service' => $serviceName]);

        self::stopOctaneService($serviceName);

        $serviceFile = self::SYSTEMD_DIR . '/' . $serviceName . '.service';
        $timerFile = self::SYSTEMD_DIR . '/' . $serviceName . '.timer';

        if (file_exists($serviceFile)) {
            unlink($serviceFile);
        }

        if (file_exists($timerFile)) {
            unlink($timerFile);
        }

        Process::run('systemctl daemon-reload');
        Process::run('systemctl reset-failed');

        Log::info('Service removed', ['service' => $serviceName]);
        return true;
    }

    /**
     * Get service status
     * SYNC: octane_service_manager.sh:status_octane_service()
     */
    public static function getServiceStatus(string $serviceName): array
    {
        $serviceResult = Process::run("systemctl status {$serviceName} --no-pager -l");
        $timerResult = Process::run("systemctl status {$serviceName}.timer --no-pager -l");
        $logsResult = Process::run("journalctl -u {$serviceName} -n 20 --no-pager");

        return [
            'service_name' => $serviceName,
            'service_status' => $serviceResult->output(),
            'timer_status' => $timerResult->output(),
            'recent_logs' => $logsResult->output(),
            'is_active' => $serviceResult->successful(),
            'timer_active' => $timerResult->successful()
        ];
    }

    /**
     * Get status of all Octane services
     * SYNC: octane_service_manager.sh:status_all_octane()
     */
    public static function getAllServicesStatus(): array
    {
        $services = self::listOctaneServices();

        if (empty($services)) {
            return [];
        }

        $statuses = [];

        foreach ($services as $service) {
            $isActive = Process::run("systemctl is-active {$service}")->successful();
            $isEnabled = Process::run("systemctl is-enabled {$service}")->successful();
            $timerActive = Process::run("systemctl is-active {$service}.timer")->successful();

            $statuses[] = [
                'service' => $service,
                'is_active' => $isActive,
                'is_enabled' => $isEnabled,
                'timer_active' => $timerActive,
                'status_text' => $isActive ? 'active' : 'inactive'
            ];
        }

        return $statuses;
    }

    /**
     * Restart all Octane services
     * SYNC: octane_service_manager.sh:restart_all_octane()
     */
    public static function restartAllOctaneServices(): array
    {
        Log::info('Restarting all Octane services');

        $services = self::listOctaneServices();

        if (empty($services)) {
            return [
                'success_count' => 0,
                'fail_count' => 0,
                'services' => []
            ];
        }

        $results = [
            'success_count' => 0,
            'fail_count' => 0,
            'services' => []
        ];

        foreach ($services as $service) {
            $result = Process::run("systemctl restart {$service}");

            if ($result->successful()) {
                $results['success_count']++;
                $results['services'][$service] = 'success';
            } else {
                $results['fail_count']++;
                $results['services'][$service] = 'failed';
            }

            sleep(1);
        }

        Log::info('Restart all completed', $results);

        return $results;
    }

    /**
     * Create and start Octane service for path (PATH-BASED - RECOMMENDED)
     * Complete workflow for path-based service deployment with self-repair
     *
     * IMPLEMENTATION STRATEGY (Solution 3):
     * - One Octane service per directory path (shared by multiple domains)
     * - Port calculated deterministically from path MD5 hash
     * - Service reuse: if service exists for path, reuse it instead of creating new one
     * - Self-repair: automatically restart failed services
     * - Idempotent: safe to run multiple times
     *
     * @param string $wwwDir Directory path
     * @param int|null $port Port number (ignored if service exists, calculated from path if null)
     * @param int $workers Number of workers
     * @param string|null $laravelPath Path to Laravel installation (defaults to $wwwDir)
     * @param string|null $serviceUser Service user
     * @param string|null $serviceGroup Service group
     * @param string|null $description Optional description (e.g., list of domains)
     */
    public static function deployOctaneServiceFromPath(
        string $wwwDir,
        ?int $port = null,
        int $workers = 4,
        ?string $laravelPath = null,
        ?string $serviceUser = null,
        ?string $serviceGroup = null,
        ?string $description = null
    ): bool {
        Log::info('Deploying Octane service for path (idempotent)', [
            'www_dir' => $wwwDir,
            'requested_port' => $port,
            'workers' => $workers
        ]);

        // STEP 1: Check if service already exists for this path
        $existing = self::findExistingServiceForPath($wwwDir);

        if ($existing !== null) {
            // Service exists - reuse it
            Log::info('Found existing Octane service for path (reusing)', [
                'www_dir' => $wwwDir,
                'service_name' => $existing['service_name'],
                'port' => $existing['port'],
                'path_hash' => $existing['path_hash']
            ]);

            // STEP 1.5: Update service description if provided (to reflect all domains using this service)
            if ($description !== null) {
                Log::info('Updating service description for shared service', [
                    'service_name' => $existing['service_name'],
                    'description' => $description
                ]);

                // Regenerate service file with updated description
                if (!self::createOctaneServiceFromPath($wwwDir, $existing['port'], $workers, $laravelPath, $serviceUser, $serviceGroup, $description)) {
                    Log::warning('Failed to update service description, continuing anyway');
                } else {
                    // Reload systemd daemon to pick up the updated description
                    Process::run('systemctl daemon-reload');
                    Log::info('Service description updated successfully');
                }
            }

            // STEP 2: Self-repair - check if service is running
            $isActive = Process::run("systemctl is-active {$existing['service_name']}")->successful();

            if (!$isActive) {
                // Service exists but not running - restart it (self-repair)
                Log::warning('Existing service not running, restarting (self-repair)', [
                    'service_name' => $existing['service_name']
                ]);

                // First, try to stop any stuck processes
                self::stopOctaneService($existing['service_name']);
                sleep(2);

                // Restart the service
                if (!self::startOctaneService($existing['service_name'])) {
                    Log::error('Failed to restart existing service', [
                        'service_name' => $existing['service_name']
                    ]);
                    return false;
                }

                Log::info('Service restarted successfully (self-repair)', [
                    'service_name' => $existing['service_name']
                ]);
            } else {
                Log::info('Existing service is running, no action needed', [
                    'service_name' => $existing['service_name']
                ]);
            }

            // Return success - service is ready
            return true;
        }

        // STEP 3: No existing service - calculate deterministic port and create new service
        if ($port === null) {
            $port = self::getPortFromPathHash($wwwDir);
            Log::info('Calculated deterministic port from path', [
                'www_dir' => $wwwDir,
                'port' => $port,
                'path_hash' => self::getPathHash($wwwDir)
            ]);
        }

        // STEP 4: Create new service
        if (!self::createOctaneServiceFromPath($wwwDir, $port, $workers, $laravelPath, $serviceUser, $serviceGroup, $description)) {
            Log::error('Failed to create new service');
            return false;
        }

        $serviceName = self::getOctaneServiceNameFromPath($wwwDir, $port);

        // STEP 5: Start new service
        if (!self::startOctaneService($serviceName)) {
            Log::error('Failed to start new service', ['service' => $serviceName]);
            return false;
        }

        Log::info('Octane service deployed successfully (path-based)', [
            'www_dir' => $wwwDir,
            'service' => $serviceName,
            'port' => $port,
            'path_hash' => self::getPathHash($wwwDir),
            'description' => $description
        ]);

        return true;
    }

    /**
     * Stop and remove Octane service for path (PATH-BASED - RECOMMENDED)
     */
    public static function undeployOctaneServiceFromPath(string $wwwDir, int $port): bool
    {
        $serviceName = self::getOctaneServiceNameFromPath($wwwDir, $port);

        return self::removeOctaneService($serviceName);
    }

    /**
     * Create and start Octane service for domain (LEGACY - DOMAIN-BASED)
     * @deprecated Use deployOctaneServiceFromPath() instead
     * Complete workflow
     */
    public static function deployOctaneService(
        string $domain,
        ?int $port = null,
        int $workers = 4,
        ?string $laravelPath = null,
        ?string $serviceUser = null,
        ?string $serviceGroup = null
    ): bool {
        // Get or assign port
        if ($port === null) {
            $port = self::getNextAvailablePort();
        }

        if (!self::createOctaneService($domain, $port, $workers, $laravelPath, $serviceUser, $serviceGroup)) {
            return false;
        }

        $serviceName = self::getOctaneServiceName($domain, $port);

        if (!self::startOctaneService($serviceName)) {
            return false;
        }

        Log::info('Octane service deployed successfully', [
            'domain' => $domain,
            'service' => $serviceName,
            'port' => $port
        ]);

        return true;
    }

    /**
     * Stop and remove Octane service for domain
     */
    public static function undeployOctaneService(string $domain, int $port): bool
    {
        $serviceName = self::getOctaneServiceName($domain, $port);

        return self::removeOctaneService($serviceName);
    }

    /**
     * Clean up orphaned Octane services and timers
     * Removes services that are no longer referenced in the domain database
     *
     * @return array Cleanup results with removed services
     */
    public static function cleanupOrphanedServices(): array
    {
        $results = [
            'scanned' => 0,
            'removed' => [],
            'kept' => [],
            'errors' => []
        ];

        // Get all existing Octane services
        $allServices = self::listOctaneServices();
        $results['scanned'] = count($allServices);

        // Get all valid services from domain database
        $validServices = [];
        $domains = ServerManagerV1DomainManager::getAllDomains();

        foreach ($domains as $domain => $config) {
            $phpMode = ServerManagerV1PathConfig::normalizePhpMode($config['php_mode'] ?? 'fpm');

            if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
                $wwwDir = $config['www_dir'] ?? '';
                $port = $config['swoole_port'] ?? null;

                if ($wwwDir && $port) {
                    $serviceName = self::getOctaneServiceNameFromPath($wwwDir, $port);
                    $validServices[] = $serviceName;
                }
            }
        }

        // Remove duplicates
        $validServices = array_unique($validServices);

        // Check each existing service
        foreach ($allServices as $service) {
            if (!in_array($service, $validServices)) {
                // Service is orphaned - remove it
                try {
                    if (self::removeOctaneService($service)) {
                        $results['removed'][] = $service;
                        Log::info('Removed orphaned Octane service', ['service' => $service]);
                    } else {
                        $results['errors'][] = "Failed to remove: $service";
                    }
                } catch (\Exception $e) {
                    $results['errors'][] = "Error removing $service: " . $e->getMessage();
                    Log::error('Failed to remove orphaned service', [
                        'service' => $service,
                        'error' => $e->getMessage()
                    ]);
                }
            } else {
                $results['kept'][] = $service;
            }
        }

        Log::info('Octane services cleanup completed', [
            'scanned' => $results['scanned'],
            'removed' => count($results['removed']),
            'kept' => count($results['kept']),
            'errors' => count($results['errors'])
        ]);

        // Clean up systemd cache for not-found units after removing services
        if (count($results['removed']) > 0) {
            $cacheResults = self::cleanupSystemdCache();
            $results['cache_cleaned'] = count($cacheResults['cleaned']);
            Log::info('Systemd cache cleaned after service removal', [
                'cache_cleaned_count' => $results['cache_cleaned']
            ]);
        }

        return $results;
    }

    /**
     * Clean up systemd cache for not-found timer references
     * This removes the "not-found" entries from systemctl list-units output
     *
     * @return array Cleanup results with cleaned units
     */
    public static function cleanupSystemdCache(): array
    {
        $results = [
            'cleaned' => [],
            'errors' => []
        ];

        try {
            // Step 1: Find all not-found octane units
            $listResult = Process::run('systemctl list-units --all --state=not-found --no-legend');

            if ($listResult->successful()) {
                $lines = explode("\n", trim($listResult->output()));
                $notFoundUnits = [];

                foreach ($lines as $line) {
                    if (empty(trim($line))) {
                        continue;
                    }

                    // Extract unit name from systemctl output
                    if (preg_match('/^\s*●?\s*([^\s]+)\s+not-found/', $line, $matches)) {
                        $unitName = $matches[1];

                        // Only process octane-related units
                        if (strpos($unitName, 'octane-') === 0) {
                            $notFoundUnits[] = $unitName;
                        }
                    }
                }

                // Step 2: Aggressively clean each not-found unit
                foreach ($notFoundUnits as $unit) {
                    Log::info('Cleaning not-found unit', ['unit' => $unit]);

                    // Try to stop (will fail but clears some cache)
                    Process::run("systemctl stop $unit 2>/dev/null");

                    // Try to disable (will fail but clears some cache)
                    Process::run("systemctl disable $unit 2>/dev/null");

                    // Mask then unmask to force systemd to forget about it
                    Process::run("systemctl mask $unit 2>/dev/null");
                    Process::run("systemctl unmask $unit 2>/dev/null");

                    // Try to reset the specific unit
                    Process::run("systemctl reset-failed $unit 2>/dev/null");

                    $results['cleaned'][] = $unit;
                }
            }

            // Step 3: Clear journal entries for cleaned units
            foreach ($results['cleaned'] as $unit) {
                Process::run("journalctl --vacuum-time=1s -u $unit 2>/dev/null");
            }

            // Step 4: Reload systemd daemon to refresh unit cache
            Process::run('systemctl daemon-reload');

            // Step 5: Reset failed units to clear references
            Process::run('systemctl reset-failed');

            // Step 6: One more daemon-reload to ensure cache is fully refreshed
            Process::run('systemctl daemon-reload');

            Log::info('Systemd cache cleanup completed', [
                'cleaned_count' => count($results['cleaned']),
                'cleaned_units' => $results['cleaned']
            ]);

            return $results;
        } catch (\Exception $e) {
            Log::error('Failed to clean systemd cache', ['error' => $e->getMessage()]);
            $results['errors'][] = $e->getMessage();
            return $results;
        }
    }
}
