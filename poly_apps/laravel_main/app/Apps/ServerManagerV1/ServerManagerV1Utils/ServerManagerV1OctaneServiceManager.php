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
 * - Web API calls: Default user is 'ubuntu' (real system user)
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
     * Determine service user for Octane services
     * ALWAYS returns 'root' for maximum permissions (TTS queue file write requirements)
     *
     * SYNC: octane_service_manager.sh:create_octane_service() Line 169-172
     * MUST MATCH: service_user="root", service_group="root"
     */
    public static function getDefaultServiceUser(): string
    {
        // SYNC WITH SHELL: Force root user for maximum permissions
        // SHELL EQUIVALENT: service_user="root" (Line 171)
        // Required for:
        // - TTS queue file writes to /www/wwwroot/laravel_db
        // - System-level operations
        // - Avoiding permission conflicts
        return 'root';
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
     *
     * Service naming: octane-{app_name}-{port}
     * - poly: octane-poly-9000
     * - AChatV1: octane-achatv1-9001
     */
    public static function getOctaneServiceNameFromPath(string $wwwDir, int $port): string
    {
        $laravelMainDir = PathMapper::getLaravelMainDir();

        // Check if this is poly (laravel_main itself)
        if (realpath($wwwDir) === realpath($laravelMainDir)) {
            return self::OCTANE_SERVICE_PREFIX . 'poly-' . $port;
        }

        // For apps in app/Apps, use lowercase app name
        $appName = strtolower(basename($wwwDir));
        return self::OCTANE_SERVICE_PREFIX . $appName . '-' . $port;
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
        $result = Process::path(base_path())->run('systemctl list-units --type=service --all | grep "^  ' . self::OCTANE_SERVICE_PREFIX . '"');

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
     * Get default workers count based on CPU cores
     * Returns CPU core count, minimum 1, maximum 16
     */
    public static function getDefaultWorkers(): int
    {
        $cpuCores = (int)shell_exec('nproc 2>/dev/null');
        if ($cpuCores < 1) {
            $cpuCores = 4;
        }

        $workers = min(max($cpuCores, 1), 16);

        Log::debug('Calculated default workers', [
            'cpu_cores' => $cpuCores,
            'workers' => $workers
        ]);

        return $workers;
    }

    /**
     * Get app index from app directory scan
     * Scans poly_apps/laravel_main/app/Apps and assigns index based on alphabetical order
     * 'poly' (laravel_main itself) is always index 0
     *
     * @param string $wwwDir Full path to the application directory
     * @return int App index (0 for poly, 1+ for apps in alphabetical order)
     */
    private static function getAppIndex(string $wwwDir): int
    {
        $laravelMainDir = PathMapper::getLaravelMainDir();

        // Check if this is the poly app itself (laravel_main)
        if (realpath($wwwDir) === realpath($laravelMainDir)) {
            Log::debug('App index for poly (laravel_main)', [
                'www_dir' => $wwwDir,
                'index' => 0,
                'port_offset' => 0
            ]);
            return 0;
        }

        // Scan app/Apps directory for other applications
        $appsDir = $laravelMainDir . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'Apps';

        if (!is_dir($appsDir)) {
            Log::warning('Apps directory not found, defaulting to index 0', [
                'apps_dir' => $appsDir,
                'www_dir' => $wwwDir
            ]);
            return 0;
        }

        $apps = [];
        $entries = @scandir($appsDir);

        if ($entries !== false) {
            foreach ($entries as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }

                $fullPath = $appsDir . DIRECTORY_SEPARATOR . $entry;
                if (is_dir($fullPath)) {
                    $apps[] = $entry;
                }
            }
        }

        // Sort alphabetically
        sort($apps);

        // Find index of current app
        $appName = basename($wwwDir);
        $index = array_search($appName, $apps);

        if ($index === false) {
            Log::warning('App not found in Apps directory, defaulting to index 0', [
                'app_name' => $appName,
                'www_dir' => $wwwDir,
                'scanned_apps' => $apps
            ]);
            return 0;
        }

        // Apps start from index 1 (poly is 0)
        $finalIndex = $index + 1;

        Log::debug('App index calculated', [
            'www_dir' => $wwwDir,
            'app_name' => $appName,
            'scanned_apps' => $apps,
            'index' => $finalIndex,
            'port_offset' => $finalIndex
        ]);

        return $finalIndex;
    }

    /**
     * Calculate deterministic port from app index
     * Port = 9000 + app_index
     * - poly (laravel_main itself): 9000 (index 0)
     * - Other apps in app/Apps: 9001, 9002, ... (alphabetical order)
     *
     * @param string $wwwDir Full path to the application directory
     * @return int Port number
     */
    public static function getPortFromPathHash(string $wwwDir): int
    {
        $appIndex = self::getAppIndex($wwwDir);
        $port = self::SWOOLE_PORT_START + $appIndex;

        Log::debug('Calculated port from app index', [
            'www_dir' => $wwwDir,
            'app_index' => $appIndex,
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
        $laravelMainDir = PathMapper::getLaravelMainDir();
        $services = self::listOctaneServices();

        // Determine app identifier
        $appIdentifier = (realpath($wwwDir) === realpath($laravelMainDir))
            ? 'poly'
            : strtolower(basename($wwwDir));

        foreach ($services as $service) {
            // Check if service name matches this app
            // Service naming: octane-{app_name}-{port}
            if (strpos($service, self::OCTANE_SERVICE_PREFIX . $appIdentifier . '-') === 0) {
                // Extract port from service name
                if (preg_match('/(\d+)$/', $service, $matches)) {
                    Log::info('Found existing service for path', [
                        'www_dir' => $wwwDir,
                        'app_identifier' => $appIdentifier,
                        'service_name' => $service,
                        'port' => (int)$matches[1]
                    ]);

                    return [
                        'service_name' => $service,
                        'port' => (int)$matches[1],
                        'app_identifier' => $appIdentifier
                    ];
                }
            }
        }

        Log::debug('No existing service found for path', [
            'www_dir' => $wwwDir,
            'app_identifier' => $appIdentifier
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
     * Create Octane service (PATH-BASED) using systemd with php artisan octane:start
     * Simplified approach: systemd manages the process, ExecStart uses php artisan directly
     *
     * @param string $wwwDir Directory path (used for service naming)
     * @param int|null $port Port number (auto-calculated from app index if null)
     * @param int|null $workers Number of workers (auto-calculated from CPU cores if null)
     * @param string|null $laravelPath Path to Laravel installation (defaults to $wwwDir)
     * @param string|null $serviceUser Service user (defaults based on context)
     * @param string|null $serviceGroup Service group (defaults to $serviceUser)
     * @param string|null $description Optional description (e.g., list of domains using this service)
     * @param string $host Host to bind to (default: 0.0.0.0 for all interfaces, use 127.0.0.1 for localhost only)
     */
    public static function createOctaneServiceFromPath(
        string $wwwDir,
        ?int $port = null,
        ?int $workers = null,
        ?string $laravelPath = null,
        ?string $serviceUser = null,
        ?string $serviceGroup = null,
        ?string $description = null,
        string $host = '0.0.0.0'
    ): bool {
        if ($port === null) {
            $port = self::getPortFromPathHash($wwwDir);
            Log::info('Auto-calculated port from app index', ['www_dir' => $wwwDir, 'port' => $port]);
        }

        if ($workers === null) {
            $workers = self::getDefaultWorkers();
            Log::info('Auto-calculated workers from CPU cores', ['workers' => $workers]);
        }

        if ($laravelPath === null) {
            $laravelPath = $wwwDir;
        }

        if (!is_dir($laravelPath)) {
            Log::error('Laravel path not found', ['path' => $laravelPath]);
            return false;
        }

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

        Log::info('Creating Octane service (path-based, simplified)', [
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
            $description,
            $host
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
     * Check if running in desktop environment
     * Desktop environments get hot-reload via --watch flag
     */
    private static function isDesktopEnvironment(): bool
    {
        if (getenv('DISPLAY') || getenv('WAYLAND_DISPLAY')) {
            return true;
        }

        $result = Process::run('systemctl --user is-active --quiet graphical-session.target 2>/dev/null');
        if ($result->successful()) {
            return true;
        }

        $result = Process::run('dpkg -l 2>/dev/null | grep -qE "ubuntu-desktop|gnome-shell|kde-plasma|xfce4"');
        if ($result->successful()) {
            return true;
        }

        return false;
    }

    /**
     * Generate systemd service file content (PATH-BASED)
     *
     * SYNC: octane_service_manager.sh:create_octane_service() Line 220-261
     * CRITICAL: This function MUST generate identical output to shell script
     *
     * SYNC REQUIREMENTS:
     * 1. User=$serviceUser (must be 'root' from getDefaultServiceUser)
     * 2. ProtectSystem=full (NOT strict)
     * 3. No ReadWritePaths needed (service runs as root)
     *
     * Features:
     * - Auto-restart on failure
     * - Memory limit: 20% of total system memory per service
     * - 48-hour auto-restart via timer (prevents memory leaks)
     * - Path-based naming: One service per directory, shared by multiple domains
     * - Configurable host binding (0.0.0.0 for all IPs, 127.0.0.1 for localhost only)
     * - Desktop environment: Adds --watch flag for hot reload
     */
    private static function generateServiceFileContentFromPath(
        string $wwwDir,
        int $port,
        int $workers,
        string $laravelPath,
        string $serviceName,
        string $serviceUser,
        string $serviceGroup,
        ?string $description = null,
        string $host = '0.0.0.0'
    ): string {
        // Calculate 20% of system memory
        $memInfo = file_get_contents('/proc/meminfo');
        preg_match('/MemTotal:\s+(\d+)\s+kB/', $memInfo, $matches);
        $totalMemoryKB = isset($matches[1]) ? (int)$matches[1] : 8000000; // Fallback 8GB
        $memoryLimitKB = (int)($totalMemoryKB * 0.2); // 20% of total memory
        $memoryLimitMB = (int)($memoryLimitKB / 1024);

        $pathHash = self::getPathHash($wwwDir);
        $descLine = $description ? " ($description)" : '';

        $phpBinary = PathMapper::getPhpBinaryPath();

        $isDesktop = self::isDesktopEnvironment();
        $watchFlag = $isDesktop ? ' --watch' : '';
        $envNote = $isDesktop ? ' (Desktop: Hot-reload enabled)' : ' (Server: 48h timer)';

        Log::info('Generating Octane service', [
            'is_desktop' => $isDesktop,
            'watch_enabled' => $isDesktop,
            'service' => $serviceName
        ]);

        return <<<EOF
[Unit]
Description=Laravel Octane Server for path {$pathHash} on port {$port}{$descLine}{$envNote}
After=network.target mysql.service redis.service
Wants=network-online.target

[Service]
Type=simple
User={$serviceUser}
Group={$serviceGroup}
WorkingDirectory={$laravelPath}
ExecStart={$phpBinary} {$laravelPath}/artisan octane:start --host={$host} --port={$port} --workers={$workers}{$watchFlag}
ExecReload=/bin/kill -USR1 \$MAINPID

# Auto-restart configuration
Restart=always
RestartSec=10

# Timeout configuration
TimeoutStopSec=30
TimeoutStartSec=60

# Kill mode configuration
KillMode=mixed
KillSignal=SIGTERM

# Memory limit: 20% of system memory (~{$memoryLimitMB}MB)
MemoryMax={$memoryLimitKB}K
MemoryHigh={$memoryLimitKB}K

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier={$serviceName}

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_PATH=/usr/local/lib/node_modules"

# Security (Relaxed for development/TTS requirements)
# SYNC: octane_service_manager.sh Line 270-276
# CRITICAL: Service runs as root, ProtectSystem=full provides sufficient protection
# CRITICAL: No ReadWritePaths needed when running as root
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF;
    }

    /**
     * Generate systemd service file content (LEGACY - DOMAIN-BASED)
     * @deprecated Use generateServiceFileContentFromPath() instead
     *
     * SYNC: octane_service_manager.sh:create_octane_service() Line 220-261
     * CRITICAL: This function MUST generate identical output to shell script
     *
     * SYNC REQUIREMENTS:
     * 1. User=$serviceUser (must be 'root' from getDefaultServiceUser)
     * 2. ProtectSystem=full (NOT strict)
     * 3. No ReadWritePaths needed (service runs as root)
     *
     * Features:
     * - Auto-restart on failure
     * - Memory limit: 20% of total system memory per service
     * - 48-hour auto-restart via timer (prevents memory leaks)
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

        $phpBinary = PathMapper::getPhpBinaryPath();

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
ExecStart={$phpBinary} {$laravelPath}/artisan octane:start --host=0.0.0.0 --port={$port} --workers={$workers}
ExecReload=/bin/kill -USR1 \$MAINPID

# Auto-restart configuration
Restart=always
RestartSec=10

# Timeout configuration
TimeoutStopSec=30
TimeoutStartSec=60

# Kill mode configuration
KillMode=mixed
KillSignal=SIGTERM

# Memory limit: 20% of system memory (~{$memoryLimitMB}MB)
MemoryMax={$memoryLimitKB}K
MemoryHigh={$memoryLimitKB}K

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier={$serviceName}

# Environment
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_PATH=/usr/local/lib/node_modules"

# Security (Relaxed for development/TTS requirements)
# SYNC: octane_service_manager.sh Line 270-276
# CRITICAL: Service runs as root, ProtectSystem=full provides sufficient protection
# CRITICAL: No ReadWritePaths needed when running as root
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full

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
     * Start Octane service via systemd
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
     * Stop Octane service via systemd
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
     * Restart Octane service via systemd
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
     * Get current running Octane service name for this Laravel application
     * Automatically detects service based on current Laravel path
     *
     * @param string|null $laravelPath Laravel application path (defaults to base_path())
     * @return string|null Service name if found, null otherwise
     */
    public static function getCurrentOctaneServiceName(?string $laravelPath = null): ?string
    {
        if ($laravelPath === null) {
            $laravelPath = base_path();
        }

        // Find service for this path
        $serviceInfo = self::findExistingServiceForPath($laravelPath);

        if ($serviceInfo !== null) {
            Log::debug('Found current Octane service', [
                'service_name' => $serviceInfo['service_name'],
                'path' => $laravelPath,
                'port' => $serviceInfo['port']
            ]);

            return $serviceInfo['service_name'];
        }

        Log::warning('No Octane service found for current path', [
            'path' => $laravelPath,
            'path_hash' => self::getPathHash($laravelPath)
        ]);

        return null;
    }

    /**
     * Restart current Octane service (auto-detect service name)
     * Automatically detects and restarts the Octane service for current Laravel application
     *
     * @param string|null $laravelPath Laravel application path (defaults to base_path())
     * @return bool True if restart succeeded, false otherwise
     */
    public static function restartCurrentOctaneService(?string $laravelPath = null): bool
    {
        $serviceName = self::getCurrentOctaneServiceName($laravelPath);

        if ($serviceName === null) {
            Log::error('Cannot restart: No Octane service found for current path', [
                'path' => $laravelPath ?? base_path()
            ]);
            return false;
        }

        return self::restartOctaneService($serviceName);
    }

    /**
     * Restart current Octane service in background with delay (auto-detect service name)
     *
     * This is useful for file watchers and hot-reload scenarios where the restart
     * needs to be scheduled in the background to allow the current process tick to complete.
     *
     * The delay allows state updates (like file hashes) to be written before the process is killed.
     *
     * @param int $delaySeconds Delay in seconds before restart (default: 1)
     * @param string|null $laravelPath Laravel application path (defaults to base_path())
     * @return bool True if restart was scheduled, false if service not found
     */
    public static function restartCurrentOctaneServiceDelayed(int $delaySeconds = 1, ?string $laravelPath = null): bool
    {
        $serviceName = self::getCurrentOctaneServiceName($laravelPath);

        if ($serviceName === null) {
            Log::error('Cannot restart: No Octane service found for current path', [
                'path' => $laravelPath ?? base_path()
            ]);
            return false;
        }

        Log::info('Scheduling background service restart', [
            'service' => $serviceName,
            'delay' => $delaySeconds . 's'
        ]);

        // Schedule restart in background (non-blocking)
        // This allows the current process tick to complete before restart happens
        $result = Process::run(
            "nohup bash -c 'sleep {$delaySeconds} && systemctl restart {$serviceName}' > /dev/null 2>&1 &"
        );

        if (!$result->successful()) {
            Log::error('Failed to schedule background restart', [
                'service' => $serviceName,
                'output' => $result->output()
            ]);
            return false;
        }

        Log::info('Background service restart scheduled', [
            'service' => $serviceName,
            'delay' => $delaySeconds . 's'
        ]);

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
     * IMPLEMENTATION STRATEGY:
     * - One Octane service per directory path (shared by multiple domains)
     * - Port calculated from app index (9000 + index based on app/Apps alphabetical order)
     * - Workers calculated from CPU cores (auto-detect nproc)
     * - Service reuse: if service exists for path, reuse it instead of creating new one
     * - Self-repair: automatically restart failed services
     * - Idempotent: safe to run multiple times
     *
     * @param string $wwwDir Directory path
     * @param int|null $port Port number (auto-calculated from app index if null)
     * @param int|null $workers Number of workers (auto-calculated from CPU cores if null)
     * @param string|null $laravelPath Path to Laravel installation (defaults to $wwwDir)
     * @param string|null $serviceUser Service user
     * @param string|null $serviceGroup Service group
     * @param string|null $description Optional description (e.g., list of domains)
     * @param string $host Host to bind to (default: 0.0.0.0 for all interfaces)
     */
    public static function deployOctaneServiceFromPath(
        string $wwwDir,
        ?int $port = null,
        ?int $workers = null,
        ?string $laravelPath = null,
        ?string $serviceUser = null,
        ?string $serviceGroup = null,
        ?string $description = null,
        string $host = '0.0.0.0'
    ): bool {
        // Auto-calculate port and workers if not provided
        if ($port === null) {
            $port = self::getPortFromPathHash($wwwDir);
        }

        if ($workers === null) {
            $workers = self::getDefaultWorkers();
        }

        Log::info('Deploying Octane service for path (idempotent)', [
            'www_dir' => $wwwDir,
            'port' => $port,
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
                'app_identifier' => $existing['app_identifier']
            ]);

            // STEP 2: Self-repair - check if service is running
            $isActive = Process::run("systemctl is-active {$existing['service_name']}")->successful();

            if (!$isActive) {
                Log::warning('Existing service not running, restarting (self-repair)', [
                    'service_name' => $existing['service_name']
                ]);

                self::stopOctaneService($existing['service_name']);
                sleep(2);

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

            return true;
        }

        // STEP 3: No existing service - create new service with calculated port/workers
        Log::info('Creating new Octane service', [
            'www_dir' => $wwwDir,
            'port' => $port,
            'workers' => $workers
        ]);

        // STEP 4: Create new service
        if (!self::createOctaneServiceFromPath($wwwDir, $port, $workers, $laravelPath, $serviceUser, $serviceGroup, $description, $host)) {
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
            'workers' => $workers,
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
            // All Laravel/PHP sites use swoole mode only
            if (in_array($config['type'] ?? 'laravel', ['laravel', 'poly', 'php'])) {
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

        return $results;
    }

    /**
     * Clean up systemd cache for not-found and failed units
     * Removes orphaned timer files and resets failed states
     *
     * @return array Cleanup results
     */
    public static function cleanupSystemdCache(): array
    {
        $results = [
            'cleaned' => [],
            'orphaned_timers' => [],
            'errors' => []
        ];

        Log::info('Cleaning systemd cache for Octane services');

        $notFoundUnits = [];
        $result = Process::run('systemctl list-units --type=service --all | grep "' . self::OCTANE_SERVICE_PREFIX . '" | grep "not-found"');

        if ($result->successful()) {
            $lines = explode("\n", trim($result->output()));
            foreach ($lines as $line) {
                if (preg_match('/●\s+(' . self::OCTANE_SERVICE_PREFIX . '[^\s]+)\.service/', $line, $matches)) {
                    $notFoundUnits[] = $matches[1];
                }
            }
        }

        foreach ($notFoundUnits as $unit) {
            $resetResult = Process::run("systemctl reset-failed {$unit}.service 2>&1");
            if ($resetResult->successful()) {
                $results['cleaned'][] = $unit;
                Log::info('Cleaned not-found unit from systemd cache', ['unit' => $unit]);
            } else {
                $results['errors'][] = "Failed to reset {$unit}: " . $resetResult->errorOutput();
            }
        }

        $timerFiles = glob(self::SYSTEMD_DIR . '/' . self::OCTANE_SERVICE_PREFIX . '*.timer');
        foreach ($timerFiles as $timerFile) {
            $timerName = basename($timerFile, '.timer');
            $serviceFile = self::SYSTEMD_DIR . '/' . $timerName . '.service';

            if (!file_exists($serviceFile)) {
                if (@unlink($timerFile)) {
                    $results['orphaned_timers'][] = basename($timerFile);
                    Log::info('Removed orphaned timer file', ['timer' => basename($timerFile)]);
                } else {
                    $results['errors'][] = "Failed to remove orphaned timer: " . basename($timerFile);
                }
            }
        }

        Process::run('systemctl daemon-reload');
        Process::run('systemctl reset-failed');

        Log::info('Systemd cache cleanup completed', [
            'cleaned' => count($results['cleaned']),
            'orphaned_timers' => count($results['orphaned_timers']),
            'errors' => count($results['errors'])
        ]);

        return $results;
    }

    /**
     * Get all valid services based on current app structure
     * Returns array of service names that SHOULD exist based on calculation
     *
     * @return array List of valid service names
     */
    public static function getValidServiceNames(): array
    {
        $validServices = [];
        $laravelMainDir = PathMapper::getLaravelMainDir();

        $validServices[] = self::getOctaneServiceNameFromPath($laravelMainDir, self::SWOOLE_PORT_START);

        $appsDir = $laravelMainDir . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'Apps';
        if (is_dir($appsDir)) {
            $apps = [];
            $entries = @scandir($appsDir);

            if ($entries !== false) {
                foreach ($entries as $entry) {
                    if ($entry === '.' || $entry === '..') {
                        continue;
                    }

                    $fullPath = $appsDir . DIRECTORY_SEPARATOR . $entry;
                    if (is_dir($fullPath)) {
                        $apps[] = $entry;
                    }
                }
            }

            sort($apps);

            foreach ($apps as $index => $appName) {
                $appDir = $appsDir . DIRECTORY_SEPARATOR . $appName;
                $port = self::SWOOLE_PORT_START + ($index + 1);
                $serviceName = self::getOctaneServiceNameFromPath($appDir, $port);
                $validServices[] = $serviceName;
            }
        }

        Log::debug('Calculated valid service names', [
            'count' => count($validServices),
            'services' => $validServices
        ]);

        return $validServices;
    }

    /**
     * Clean up all services not in valid calculation range
     * Removes services with wrong naming or ports outside calculated range
     *
     * @return array Cleanup results
     */
    public static function cleanupInvalidServices(): array
    {
        $results = [
            'scanned' => 0,
            'removed' => [],
            'kept' => [],
            'errors' => []
        ];

        Log::info('Cleaning up invalid Octane services');

        $allServices = self::listOctaneServices();
        $results['scanned'] = count($allServices);

        $validServices = self::getValidServiceNames();

        foreach ($allServices as $service) {
            if (strpos($service, 'octane-hot-reload') === 0 || strpos($service, 'octane-auto-restart') === 0) {
                $results['kept'][] = $service . ' (system service)';
                continue;
            }

            $shouldKeep = false;

            foreach ($validServices as $validService) {
                if ($service === $validService) {
                    $shouldKeep = true;
                    break;
                }
            }

            if (!$shouldKeep) {
                try {
                    Log::info('Removing invalid service (not in calculation range)', [
                        'service' => $service,
                        'valid_services' => $validServices
                    ]);

                    if (self::removeOctaneService($service)) {
                        $results['removed'][] = $service;
                    } else {
                        $results['errors'][] = "Failed to remove: $service";
                    }
                } catch (\Exception $e) {
                    $results['errors'][] = "Error removing $service: " . $e->getMessage();
                    Log::error('Failed to remove invalid service', [
                        'service' => $service,
                        'error' => $e->getMessage()
                    ]);
                }
            } else {
                $results['kept'][] = $service;
            }
        }

        self::cleanupSystemdCache();

        Log::info('Invalid services cleanup completed', [
            'scanned' => $results['scanned'],
            'removed' => count($results['removed']),
            'kept' => count($results['kept']),
            'errors' => count($results['errors'])
        ]);

        return $results;
    }
}
