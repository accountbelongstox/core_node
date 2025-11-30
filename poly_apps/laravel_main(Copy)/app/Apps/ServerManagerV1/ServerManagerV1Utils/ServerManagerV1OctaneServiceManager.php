<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

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
     * Get next available port for Swoole service
     * SYNC: octane_service_manager.sh:get_next_available_port()
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
ReadWritePaths={$laravelPath}/storage {$laravelPath}/bootstrap/cache

[Install]
WantedBy=multi-user.target
EOF;
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
     * Complete workflow for path-based service deployment
     *
     * @param string $wwwDir Directory path
     * @param int|null $port Port number (auto-assigned if null)
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
        // Get or assign port
        if ($port === null) {
            $port = self::getNextAvailablePort();
        }

        if (!self::createOctaneServiceFromPath($wwwDir, $port, $workers, $laravelPath, $serviceUser, $serviceGroup, $description)) {
            return false;
        }

        $serviceName = self::getOctaneServiceNameFromPath($wwwDir, $port);

        if (!self::startOctaneService($serviceName)) {
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
}
