<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use App\Providers\PathMapper;

/**
 * Nuxt Service Manager for ServerManagerV1
 *
 * Manages Nuxt PolyApp services with systemd integration
 * Similar to OctaneServiceManager but for Nuxt applications
 *
 * Service naming convention: nuxt-<appname>
 * - App-based: One service per app namespace
 * - Port assignment: 3000-3100 range (auto-assigned or manual)
 * - Factory directory: Uses factory build directory per app
 *
 * USER CONTEXT:
 * - CLI commands (artisan): Default user is 'root' (system mode)
 * - Web API calls: Dynamically detected real user (excludes system users)
 */
class ServerManagerV1NuxtServiceManager
{
    private const NUXT_SERVICE_PREFIX = 'nuxt-';
    private const NUXT_PORT_START = 10000;
    private const NUXT_PORT_END = 11000;

    /**
     * Get systemd directory from PathMapper
     */
    private static function getSystemdDir(): string
    {
        return PathMapper::mapWebPath('systemd_dir');
    }

    /**
     * Get Nuxt service name from app namespace
     */
    public static function getNuxtServiceName(string $appname): string
    {
        return self::NUXT_SERVICE_PREFIX . $appname;
    }

    /**
     * List all Nuxt services
     */
    public static function listNuxtServices(): array
    {
        $result = Process::run('systemctl list-units --type=service --all | grep "^  ' . self::NUXT_SERVICE_PREFIX . '"');

        if (!$result->successful()) {
            return [];
        }

        $services = [];
        $lines = explode("\n", trim($result->output()));

        foreach ($lines as $line) {
            if (preg_match('/^\s*(' . self::NUXT_SERVICE_PREFIX . '[^\s]+)\.service/', $line, $matches)) {
                $services[] = $matches[1];
            }
        }

        return $services;
    }

    /**
     * Check if service exists
     */
    public static function serviceExists(string $serviceName): bool
    {
        $result = Process::run("systemctl list-unit-files $serviceName.service");
        return str_contains($result->output(), "$serviceName.service");
    }

    /**
     * Get service status
     * @param string $serviceNameOrAppname Service name (e.g., "nuxt-polyapp-codemart") or app name (e.g., "codemart")
     */
    public static function getServiceStatus(string $serviceNameOrAppname): array
    {
        $serviceName = str_starts_with($serviceNameOrAppname, self::NUXT_SERVICE_PREFIX)
            ? $serviceNameOrAppname
            : self::getNuxtServiceName($serviceNameOrAppname);

        $exists = self::serviceExists($serviceName);
        $isActiveResult = Process::run("systemctl is-active $serviceName");
        $isEnabledResult = Process::run("systemctl is-enabled $serviceName");

        return [
            'name' => $serviceName,
            'exists' => $exists,
            'active' => trim($isActiveResult->output()) === 'active',
            'enabled' => trim($isEnabledResult->output()) === 'enabled',
            'status' => trim($isActiveResult->output())
        ];
    }

    /**
     * Find available port for new service
     */
    public static function findAvailablePort(): int
    {
        for ($port = self::NUXT_PORT_START; $port <= self::NUXT_PORT_END; $port++) {
            $check = Process::run("lsof -i :$port");
            if ($check->failed() || empty(trim($check->output()))) {
                return $port;
            }
        }

        throw new \RuntimeException("No available ports in range " . self::NUXT_PORT_START . "-" . self::NUXT_PORT_END);
    }

    /**
     * Find port for existing app
     */
    public static function findPortForApp(string $appname): ?int
    {
        $serviceName = self::getNuxtServiceName($appname);
        $servicePath = self::getSystemdDir() . "/$serviceName.service";

        if (!file_exists($servicePath)) {
            return null;
        }

        $content = file_get_contents($servicePath);
        if (preg_match('/PORT=(\d+)/', $content, $matches)) {
            return (int)$matches[1];
        }

        return null;
    }

    /**
     * Get factory path for app
     */
    public static function getFactoryPath(string $appname): string
    {
        $baseDataDir = PathMapper::mapWebPath('www');
        $factoryBasePath = str_replace('/www', '', $baseDataDir) . '/_build_dir/nuxt_factory/linux';
        return "$factoryBasePath/_app_$appname";
    }

    /**
     * Scan available Nuxt apps from source directory
     * Looks for app_* directories in nuxt_main/apps
     *
     * @return array List of available app names
     */
    public static function scanAvailableApps(): array
    {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        $appsPath = "$coreNodeDir/poly_apps/nuxt_main/apps";

        if (!is_dir($appsPath)) {
            return [];
        }

        $apps = [];
        $entries = scandir($appsPath);

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            // Match app_* pattern in apps directory
            if (preg_match('/^app_(.+)$/', $entry, $matches)) {
                $appDir = "$appsPath/$entry";
                if (is_dir($appDir)) {
                    $apps[] = $matches[1];
                }
            }
        }

        sort($apps);
        return $apps;
    }

    /**
     * Validate if app exists in source
     *
     * @param string $appname App namespace
     * @return bool True if app exists
     */
    public static function validateAppExists(string $appname): bool
    {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        $appsPath = "$coreNodeDir/poly_apps/nuxt_main/apps";
        $appDir = "$appsPath/app_{$appname}";

        return is_dir($appDir);
    }

    /**
     * Create systemd service file for Nuxt app
     *
     * @param string $appname App namespace
     * @param int $port Port number
     * @param string|null $user Service user (default: auto-detect)
     * @param bool $debugMode If true, runs directly from source; if false, runs from factory build
     * @return bool Success status
     */
    public static function createServiceFile(string $appname, int $port, ?string $user = null, bool $debugMode = false): bool
    {
        if ($user === null) {
            $user = self::getDefaultServiceUser();
        }

        $serviceName = self::getNuxtServiceName($appname);

        if ($debugMode) {
            $serviceContent = ServerManagerV1NuxtSystemdConfig::debug($appname, $port);
            $mode = 'debug';
        } else {
            $factoryPath = self::getFactoryPath($appname);
            $serviceContent = ServerManagerV1NuxtSystemdConfig::production($appname, $factoryPath, $port);
            $mode = 'production';
        }

        $servicePath = self::getSystemdDir() . "/$serviceName.service";

        if (!file_put_contents($servicePath, $serviceContent)) {
            Log::error('Failed to create Nuxt service file', [
                'service_name' => $serviceName,
                'path' => $servicePath,
                'mode' => $mode
            ]);
            return false;
        }

        Process::run('systemctl daemon-reload');

        Log::info('Created Nuxt service file', [
            'service_name' => $serviceName,
            'port' => $port,
            'user' => $user,
            'mode' => $mode
        ]);

        return true;
    }

    /**
     * Enable service to start on boot
     */
    public static function enableService(string $serviceName): bool
    {
        $result = Process::run("systemctl enable $serviceName");

        if ($result->failed()) {
            Log::error('Failed to enable Nuxt service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Enabled Nuxt service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Disable service from starting on boot
     */
    public static function disableService(string $serviceName): bool
    {
        $result = Process::run("systemctl disable $serviceName");

        if ($result->failed()) {
            Log::error('Failed to disable Nuxt service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Disabled Nuxt service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Start service
     */
    public static function startService(string $serviceName): bool
    {
        $result = Process::run("systemctl start $serviceName");

        if ($result->failed()) {
            Log::error('Failed to start Nuxt service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        sleep(2);

        $statusResult = Process::run("systemctl is-active $serviceName");
        $isActive = trim($statusResult->output()) === 'active';

        if (!$isActive) {
            Log::error('Nuxt service failed to start', ['service_name' => $serviceName]);
            return false;
        }

        Log::info('Started Nuxt service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Stop service
     */
    public static function stopService(string $serviceName): bool
    {
        $result = Process::run("systemctl stop $serviceName");

        if ($result->failed()) {
            Log::error('Failed to stop Nuxt service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Stopped Nuxt service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Restart service
     */
    public static function restartService(string $serviceName): bool
    {
        $result = Process::run("systemctl restart $serviceName");

        if ($result->failed()) {
            Log::error('Failed to restart Nuxt service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        sleep(2);

        $statusResult = Process::run("systemctl is-active $serviceName");
        $isActive = trim($statusResult->output()) === 'active';

        if (!$isActive) {
            Log::error('Nuxt service failed to restart', ['service_name' => $serviceName]);
            return false;
        }

        Log::info('Restarted Nuxt service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Remove service completely
     */
    public static function removeService(string $serviceName): bool
    {
        self::stopService($serviceName);
        self::disableService($serviceName);

        $servicePath = self::getSystemdDir() . "/$serviceName.service";
        if (file_exists($servicePath)) {
            // Use Process::run to delete with proper permissions
            $result = Process::run("rm -f $servicePath");
            if ($result->failed()) {
                Log::error('Failed to remove Nuxt service file', [
                    'service_name' => $serviceName,
                    'path' => $servicePath,
                    'error' => $result->errorOutput()
                ]);
                return false;
            }
        }

        Process::run('systemctl daemon-reload');

        Log::info('Removed Nuxt service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Get detailed service info including port, factory path, etc.
     */
    public static function getServiceInfo(string $appname): ?array
    {
        $serviceName = self::getNuxtServiceName($appname);

        if (!self::serviceExists($serviceName)) {
            return null;
        }

        $status = self::getServiceStatus($serviceName);
        $port = self::findPortForApp($appname);
        $factoryPath = self::getFactoryPath($appname);

        return [
            'app_name' => $appname,
            'service_name' => $serviceName,
            'port' => $port,
            'factory_path' => $factoryPath,
            'active' => $status['active'],
            'enabled' => $status['enabled'],
            'status' => $status['status'],
            'output_exists' => file_exists("$factoryPath/.output")
        ];
    }

    /**
     * Get all Nuxt services with detailed info
     */
    public static function getAllServicesInfo(): array
    {
        $services = self::listNuxtServices();
        $info = [];

        foreach ($services as $serviceName) {
            $appname = str_replace(self::NUXT_SERVICE_PREFIX, '', $serviceName);
            $serviceInfo = self::getServiceInfo($appname);

            if ($serviceInfo) {
                $info[] = $serviceInfo;
            }
        }

        return $info;
    }

    /**
     * Determine service user based on execution context
     * For Nuxt services, we prefer the real user (non-root) for better permissions
     * Logic based on: scripts/shells/linux/debian/debian_com/desktop_entry_manager.sh:detect_desktop_user()
     */
    public static function getDefaultServiceUser(): string
    {
        // System/service users to exclude
        $excludedUsers = [
            'git', 'nginx', 'www-data', 'mysql', 'postgres', 'redis', 'mongodb',
            'docker', 'systemd-network', 'systemd-resolve', 'systemd-timesync',
            '_apt', 'backup', 'bin', 'daemon', 'games', 'gnats', 'irc', 'list',
            'lp', 'mail', 'man', 'news', 'proxy', 'sync', 'sys', 'uucp',
            'sshd', 'postfix', 'ftp', 'nobody', 'nogroup', 'root'
        ];

        // 1. Try SUDO_USER first (if not excluded)
        $sudoUser = getenv('SUDO_USER');
        if ($sudoUser && !in_array($sudoUser, $excludedUsers)) {
            return $sudoUser;
        }

        // 2. Try current USER environment variable (if not excluded)
        $currentUser = getenv('USER');
        if ($currentUser && !in_array($currentUser, $excludedUsers)) {
            return $currentUser;
        }

        // 3. Try stat on laravel_main directory to get owner
        $laravelMainDir = \App\Providers\PathMapper::getLaravelMainDir();
        if ($laravelMainDir && file_exists($laravelMainDir)) {
            $result = Process::run("stat -c '%U' " . escapeshellarg($laravelMainDir));
            if ($result->successful()) {
                $owner = trim($result->output());
                if ($owner && !in_array($owner, $excludedUsers)) {
                    return $owner;
                }
            }
        }

        // 4. Check /home directory for real user (prefer ubuntu)
        if (is_dir('/home/ubuntu')) {
            return 'ubuntu';
        }

        // 5. Find any non-excluded user in /home with UID >= 1000
        $result = Process::run("find /home -maxdepth 1 -mindepth 1 -type d 2>/dev/null");
        if ($result->successful()) {
            $homeDirs = explode("\n", trim($result->output()));
            foreach ($homeDirs as $homeDir) {
                $username = basename($homeDir);
                if (!in_array($username, $excludedUsers)) {
                    // Check UID
                    $uidResult = Process::run("id -u " . escapeshellarg($username) . " 2>/dev/null");
                    if ($uidResult->successful()) {
                        $uid = (int)trim($uidResult->output());
                        if ($uid >= 1000 && $uid < 60000) {
                            return $username;
                        }
                    }
                }
            }
        }

        // Last resort: return current process user
        $result = Process::run("whoami");
        if ($result->successful()) {
            return trim($result->output());
        }

        return 'ubuntu'; // Final fallback
    }

    /**
     * Check if port is in use
     */
    public static function isPortInUse(int $port): bool
    {
        $result = Process::run("lsof -i :$port");
        return $result->successful() && !empty(trim($result->output()));
    }

    /**
     * Get service logs
     */
    public static function getServiceLogs(string $serviceName, int $lines = 50): string
    {
        $result = Process::run("journalctl -u $serviceName -n $lines --no-pager");

        if ($result->failed()) {
            return "Failed to retrieve logs for $serviceName";
        }

        return $result->output();
    }

    /**
     * Detect the current mode of an existing service
     *
     * @param string $serviceName Service name
     * @return string|null 'debug' or 'production' or null if service doesn't exist
     */
    public static function detectServiceMode(string $serviceName): ?string
    {
        $servicePath = self::getSystemdDir() . "/$serviceName.service";

        if (!file_exists($servicePath)) {
            return null;
        }

        $content = file_get_contents($servicePath);

        // Check for debug mode markers
        if (str_contains($content, 'Debug Mode') ||
            str_contains($content, 'File Watcher') ||
            str_contains($content, '--mode dev') ||
            str_contains($content, 'NODE_ENV=development')) {
            return 'debug';
        }

        // Check for production mode markers
        if (str_contains($content, 'Production') ||
            str_contains($content, '.output/server/index.mjs') ||
            str_contains($content, 'NODE_ENV=production')) {
            return 'production';
        }

        return null;
    }

    /**
     * Check if service needs mode refresh (current mode differs from requested mode)
     *
     * @param string $appname App namespace
     * @param bool $requestedDebugMode Requested debug mode
     * @return bool True if refresh is needed
     */
    public static function needsModeRefresh(string $appname, bool $requestedDebugMode): bool
    {
        $serviceName = self::getNuxtServiceName($appname);
        $currentMode = self::detectServiceMode($serviceName);

        if ($currentMode === null) {
            return false; // Service doesn't exist, no refresh needed
        }

        $requestedMode = $requestedDebugMode ? 'debug' : 'production';

        return $currentMode !== $requestedMode;
    }

    /**
     * Refresh service configuration (recreate with potentially different mode)
     *
     * @param string $appname App namespace
     * @param int $port Port number
     * @param string|null $user Service user
     * @param bool $debugMode Debug mode flag
     * @return bool Success status
     */
    public static function refreshService(string $appname, int $port, ?string $user = null, bool $debugMode = false): bool
    {
        $serviceName = self::getNuxtServiceName($appname);
        $currentMode = self::detectServiceMode($serviceName);
        $requestedMode = $debugMode ? 'debug' : 'production';

        if (!self::serviceExists($serviceName)) {
            Log::warning('Cannot refresh non-existent service', ['service_name' => $serviceName]);
            return false;
        }

        // Check if mode changed
        $modeChanged = ($currentMode !== $requestedMode);

        if ($modeChanged) {
            Log::info('Service mode changed, refreshing service', [
                'service_name' => $serviceName,
                'old_mode' => $currentMode,
                'new_mode' => $requestedMode
            ]);
        }

        // Stop the service before updating
        $wasActive = self::getServiceStatus($serviceName)['active'];
        if ($wasActive) {
            self::stopService($serviceName);
        }

        // Recreate the service file
        if (!self::createServiceFile($appname, $port, $user, $debugMode)) {
            Log::error('Failed to refresh service file', ['service_name' => $serviceName]);
            return false;
        }

        // Restart if it was running before
        if ($wasActive) {
            sleep(1); // Brief pause before restart
            if (!self::startService($serviceName)) {
                Log::error('Failed to restart service after refresh', ['service_name' => $serviceName]);
                return false;
            }
        }

        Log::info('Service refreshed successfully', [
            'service_name' => $serviceName,
            'mode' => $requestedMode,
            'mode_changed' => $modeChanged
        ]);

        return true;
    }

    /**
     * Resolve duplicate services (ensure only one service per app)
     * Removes any duplicate or conflicting service configurations
     *
     * @param string $appname App namespace
     * @return array Information about removed duplicates
     */
    public static function resolveDuplicateServices(string $appname): array
    {
        $serviceName = self::getNuxtServiceName($appname);
        $removed = [];

        // List all systemd services
        $result = Process::run("systemctl list-unit-files --type=service --all | grep nuxt-");

        if ($result->failed()) {
            return $removed;
        }

        $lines = explode("\n", trim($result->output()));
        $pattern = '/^\\s*(' . preg_quote(self::NUXT_SERVICE_PREFIX, '/') . preg_quote($appname, '/') . '[^\\s]*)\\.service/';

        foreach ($lines as $line) {
            if (preg_match($pattern, $line, $matches)) {
                $foundService = $matches[1];

                // If it's not the exact service name, it's a duplicate
                if ($foundService !== $serviceName) {
                    Log::warning('Found duplicate service', [
                        'expected' => $serviceName,
                        'found' => $foundService
                    ]);

                    // Remove the duplicate
                    if (self::removeService($foundService)) {
                        $removed[] = $foundService;
                        Log::info('Removed duplicate service', ['service_name' => $foundService]);
                    }
                }
            }
        }

        return $removed;
    }

    /**
     * Smart service creation with duplicate resolution and mode detection
     *
     * @param string $appname App namespace
     * @param int $port Port number
     * @param string|null $user Service user
     * @param bool $debugMode Debug mode flag
     * @param bool $autoResolve Auto-resolve duplicates and refresh mode
     * @return array Status information
     */
    public static function createOrRefreshService(string $appname, int $port, ?string $user = null, bool $debugMode = false, bool $autoResolve = true): array
    {
        $serviceName = self::getNuxtServiceName($appname);
        $result = [
            'success' => false,
            'action' => 'none',
            'mode' => $debugMode ? 'debug' : 'production',
            'duplicates_removed' => [],
            'mode_changed' => false,
            'port_changed' => false,
            'old_port' => null,
            'new_port' => $port
        ];

        // Step 0: Validate app exists
        if (!self::validateAppExists($appname)) {
            $result['error'] = "App '$appname' does not exist in source (app_{$appname}_pages not found)";
            Log::error('Cannot create service for non-existent app', [
                'appname' => $appname,
                'expected_dir' => "app_{$appname}_pages"
            ]);
            return $result;
        }

        // Step 1: Resolve duplicates if enabled
        if ($autoResolve) {
            $duplicates = self::resolveDuplicateServices($appname);
            $result['duplicates_removed'] = $duplicates;
        }

        // Step 2: Check if service exists and needs refresh
        if (self::serviceExists($serviceName)) {
            $currentMode = self::detectServiceMode($serviceName);
            $requestedMode = $debugMode ? 'debug' : 'production';
            $modeChanged = ($currentMode !== $requestedMode);

            // Check if port changed
            $oldPort = self::findPortForApp($appname);
            $portChanged = ($oldPort !== null && $oldPort !== $port);

            $result['mode_changed'] = $modeChanged;
            $result['port_changed'] = $portChanged;
            $result['old_port'] = $oldPort;

            if ($modeChanged && $portChanged) {
                $result['action'] = 'refreshed_mode_and_port_change';
            } elseif ($modeChanged) {
                $result['action'] = 'refreshed_mode_change';
            } elseif ($portChanged) {
                $result['action'] = 'refreshed_port_change';
            } else {
                $result['action'] = 'refreshed_no_change';
            }

            // Always refresh to ensure consistency
            $success = self::refreshService($appname, $port, $user, $debugMode);
            $result['success'] = $success;

            Log::info('Service refreshed', [
                'service_name' => $serviceName,
                'mode_changed' => $modeChanged,
                'port_changed' => $portChanged,
                'old_port' => $oldPort,
                'new_port' => $port
            ]);

            return $result;
        }

        // Step 3: Create new service
        $result['action'] = 'created';
        $success = self::createServiceFile($appname, $port, $user, $debugMode);
        $result['success'] = $success;

        if ($success) {
            self::enableService($serviceName);
            Log::info('New service created and enabled', [
                'service_name' => $serviceName,
                'port' => $port,
                'mode' => $debugMode ? 'debug' : 'production'
            ]);
        }

        return $result;
    }
}
