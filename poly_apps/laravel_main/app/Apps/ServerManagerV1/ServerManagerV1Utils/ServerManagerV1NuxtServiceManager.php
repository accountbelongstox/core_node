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
 * - CLI commands (artisan): Default user is detected real user (non-root)
 * - Web API calls: Default user is 'www-data' (current web user)
 */
class ServerManagerV1NuxtServiceManager
{
    private const NUXT_SERVICE_PREFIX = 'nuxt-';
    private const SYSTEMD_DIR = '/etc/systemd/system';
    private const NUXT_PORT_START = 3000;
    private const NUXT_PORT_END = 3100;

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
     */
    public static function getServiceStatus(string $serviceName): array
    {
        $isActiveResult = Process::run("systemctl is-active $serviceName");
        $isEnabledResult = Process::run("systemctl is-enabled $serviceName");

        return [
            'name' => $serviceName,
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
        $servicePath = self::SYSTEMD_DIR . "/$serviceName.service";

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
     * Create systemd service file for Nuxt app
     */
    public static function createServiceFile(string $appname, int $port, string $user = null): bool
    {
        if ($user === null) {
            $user = self::getDefaultServiceUser();
        }

        $serviceName = self::getNuxtServiceName($appname);
        $factoryPath = self::getFactoryPath($appname);
        $serviceContent = self::generateServiceFileContent($appname, $factoryPath, $port, $user);

        $servicePath = self::SYSTEMD_DIR . "/$serviceName.service";

        if (!file_put_contents($servicePath, $serviceContent)) {
            Log::error('Failed to create Nuxt service file', [
                'service_name' => $serviceName,
                'path' => $servicePath
            ]);
            return false;
        }

        Process::run('systemctl daemon-reload');

        Log::info('Created Nuxt service file', [
            'service_name' => $serviceName,
            'port' => $port,
            'user' => $user,
            'factory_path' => $factoryPath
        ]);

        return true;
    }

    /**
     * Generate systemd service file content
     */
    private static function generateServiceFileContent(string $appname, string $factoryPath, int $port, string $user): string
    {
        return <<<SERVICE
[Unit]
Description=Nuxt PolyApp - $appname
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$factoryPath
Environment="NODE_ENV=production"
Environment="PORT=$port"
Environment="NITRO_PORT=$port"
Environment="NUXT_APP_NAMESPACE=$appname"
ExecStart=/usr/bin/node $factoryPath/.output/server/index.mjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE;
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

        $servicePath = self::SYSTEMD_DIR . "/$serviceName.service";
        if (file_exists($servicePath)) {
            if (!unlink($servicePath)) {
                Log::error('Failed to remove Nuxt service file', [
                    'service_name' => $serviceName,
                    'path' => $servicePath
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
     */
    public static function getDefaultServiceUser(): string
    {
        // Try to detect actual desktop user
        $sudoUser = getenv('SUDO_USER');
        if ($sudoUser && $sudoUser !== 'root') {
            return $sudoUser;
        }

        // Check for common non-root users
        $commonUsers = ['ubuntu', 'www-data', 'nginx', 'node'];
        foreach ($commonUsers as $user) {
            $result = Process::run("id -u $user");
            if ($result->successful()) {
                return $user;
            }
        }

        // Fallback to www-data or root
        if (php_sapi_name() === 'cli') {
            return 'www-data';
        }

        return 'www-data';
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
}
