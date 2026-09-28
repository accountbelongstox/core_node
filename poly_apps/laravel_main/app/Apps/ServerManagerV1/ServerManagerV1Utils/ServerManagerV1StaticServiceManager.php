<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use App\Providers\PathMapper;

/**
 * Static App Service Manager for ServerManagerV1
 *
 * Manages static web app (React/Vue/Vite) deployments with systemd integration
 * Similar to NuxtServiceManager but handles two distinct modes:
 *
 * - Debug Mode: Creates systemd service running dev server (pnpm run dev)
 * - Production Mode: No systemd service, nginx serves static files directly
 *
 * Service naming convention: static-<appname>
 * - Port assignment: Auto-assigned or manual
 * - Debug mode: Runs from source directory
 * - Production mode: Serves from build output directory
 *
 * ARCHITECTURE COMPLIANCE:
 * - ✅ Only manages nginx configs and systemd services
 * - ✅ Does NOT run npm install, npm build, or file copy operations
 * - ✅ Receives pre-built paths from Shell script
 */
class ServerManagerV1StaticServiceManager
{
    private const STATIC_SERVICE_PREFIX = 'static-';
    private const STATIC_PORT_START = 3000;
    private const STATIC_PORT_END = 4000;

    /**
     * Get systemd directory from PathMapper
     */
    private static function getSystemdDir(): string
    {
        return PathMapper::mapWebPath('systemd_dir');
    }

    /**
     * Get static service name from app namespace
     */
    public static function getStaticServiceName(string $appname): string
    {
        return self::STATIC_SERVICE_PREFIX . $appname;
    }

    /**
     * List all static app services
     */
    public static function listStaticServices(): array
    {
        $result = Process::run('systemctl list-units --type=service --all | grep "^  ' . self::STATIC_SERVICE_PREFIX . '"');

        if (!$result->successful()) {
            return [];
        }

        $services = [];
        $lines = explode("\n", trim($result->output()));

        foreach ($lines as $line) {
            if (preg_match('/^\s*(' . self::STATIC_SERVICE_PREFIX . '[^\s]+)\.service/', $line, $matches)) {
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
    public static function getServiceStatus(string $serviceNameOrAppname): array
    {
        $serviceName = str_starts_with($serviceNameOrAppname, self::STATIC_SERVICE_PREFIX)
            ? $serviceNameOrAppname
            : self::getStaticServiceName($serviceNameOrAppname);

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
        for ($port = self::STATIC_PORT_START; $port <= self::STATIC_PORT_END; $port++) {
            $check = Process::run("lsof -i :$port");
            if ($check->failed() || empty(trim($check->output()))) {
                return $port;
            }
        }

        throw new \RuntimeException("No available ports in range " . self::STATIC_PORT_START . "-" . self::STATIC_PORT_END);
    }

    /**
     * Find port for existing app
     */
    public static function findPortForApp(string $appname): ?int
    {
        $serviceName = self::getStaticServiceName($appname);
        $servicePath = self::getSystemdDir() . "/$serviceName.service";

        if (!file_exists($servicePath)) {
            return null;
        }

        $content = file_get_contents($servicePath);
        if (preg_match('/PORT["\s]*=\s*["\s]*(\d+)/', $content, $matches)) {
            return (int)$matches[1];
        }

        return null;
    }

    /**
     * Detect package manager from lock files in source directory
     */
    public static function detectPackageManager(string $sourcePath): string
    {
        if (file_exists("$sourcePath/pnpm-lock.yaml")) {
            return 'pnpm';
        } elseif (file_exists("$sourcePath/yarn.lock")) {
            return 'yarn';
        } elseif (file_exists("$sourcePath/package-lock.json")) {
            return 'npm';
        }

        // Fallback: check which package manager is installed
        $checkPnpm = Process::run('which pnpm');
        if ($checkPnpm->successful()) {
            return 'pnpm';
        }

        $checkYarn = Process::run('which yarn');
        if ($checkYarn->successful()) {
            return 'yarn';
        }

        return 'npm';
    }

    /**
     * Get default service user
     */
    private static function getDefaultServiceUser(): string
    {
        // Use root to avoid permission issues
        return 'root';
    }

    /**
     * Create or refresh static app service (debug mode only)
     * Production mode doesn't need a service
     */
    public static function createOrRefreshService(string $appname, string $sourcePath, int $port, ?string $user = null, bool $debugMode = false, bool $autoResolve = true): array
    {
        $serviceName = self::getStaticServiceName($appname);
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

        // Production mode doesn't need a systemd service
        if (!$debugMode) {
            // Remove service if it exists (converting from debug to production)
            if (self::serviceExists($serviceName)) {
                self::removeService($serviceName);
                $result['action'] = 'removed_debug_service';
            } else {
                $result['action'] = 'none_needed';
            }
            $result['success'] = true;
            Log::info('Static app in production mode - no service needed', [
                'appname' => $appname,
                'source_path' => $sourcePath
            ]);
            return $result;
        }

        // Debug mode - create systemd service for dev server

        // Step 1: Resolve duplicates if enabled
        if ($autoResolve) {
            $duplicates = self::resolveDuplicateServices($appname);
            $result['duplicates_removed'] = $duplicates;
        }

        // Step 2: Check if service exists and needs refresh
        if (self::serviceExists($serviceName)) {
            // Check if port changed
            $oldPort = self::findPortForApp($appname);
            $portChanged = ($oldPort !== null && $oldPort !== $port);

            $result['port_changed'] = $portChanged;
            $result['old_port'] = $oldPort;

            if ($portChanged) {
                $result['action'] = 'refreshed_port_change';
            } else {
                $result['action'] = 'refreshed_no_change';
            }

            // Always refresh to ensure consistency
            $success = self::refreshService($appname, $sourcePath, $port, $user);
            $result['success'] = $success;

            Log::info('Static app service refreshed', [
                'service_name' => $serviceName,
                'port_changed' => $portChanged,
                'old_port' => $oldPort,
                'new_port' => $port
            ]);

            return $result;
        }

        // Step 3: Create new service
        $result['action'] = 'created';
        $success = self::createServiceFile($appname, $sourcePath, $port, $user);
        $result['success'] = $success;

        if ($success) {
            self::enableService($serviceName);
            Log::info('New static app service created and enabled', [
                'service_name' => $serviceName,
                'port' => $port,
                'source_path' => $sourcePath
            ]);
        }

        return $result;
    }

    /**
     * Create systemd service file for debug mode
     * Runs dev server (pnpm run dev) from source directory
     */
    public static function createServiceFile(string $appname, string $sourcePath, int $port, ?string $user = null): bool
    {
        if ($user === null) {
            $user = self::getDefaultServiceUser();
        }

        $serviceName = self::getStaticServiceName($appname);
        $packageManager = self::detectPackageManager($sourcePath);

        $serviceContent = self::generateDebugServiceFileContent($appname, $sourcePath, $port, $user, $packageManager);

        $servicePath = self::getSystemdDir() . "/$serviceName.service";

        if (!file_put_contents($servicePath, $serviceContent)) {
            Log::error('Failed to create static app service file', [
                'service_name' => $serviceName,
                'path' => $servicePath,
                'source_path' => $sourcePath
            ]);
            return false;
        }

        Process::run('systemctl daemon-reload');

        Log::info('Created static app service file', [
            'service_name' => $serviceName,
            'port' => $port,
            'user' => $user,
            'source_path' => $sourcePath,
            'package_manager' => $packageManager
        ]);

        return true;
    }

    /**
     * Generate systemd service file content for debug mode
     * Runs dev server from source directory
     */
    private static function generateDebugServiceFileContent(string $appname, string $sourcePath, int $port, string $user, string $packageManager): string
    {
        $nodePath = PathMapper::getNodeBinaryPath();
        $nodeBinDir = dirname($nodePath);

        // Get package manager binary path
        $pmBinaryPath = match($packageManager) {
            'pnpm' => PathMapper::getPnpmBinaryPath(),
            'yarn' => exec('which yarn'),
            default => exec('which npm')
        };
        $pmBinDir = dirname($pmBinaryPath);

        // Build PATH with node and package manager directories
        $pathDirs = array_unique([$nodeBinDir, $pmBinDir, '/usr/local/bin', '/usr/bin', '/bin']);
        $pathEnv = implode(':', $pathDirs);

        // Dev command
        $devCommand = match($packageManager) {
            'pnpm' => "pnpm run dev --port $port --host 0.0.0.0",
            'yarn' => "yarn dev --port $port --host 0.0.0.0",
            default => "npm run dev -- --port $port --host 0.0.0.0"
        };

        return <<<SERVICE
[Unit]
Description=Static App Dev Server - $appname (Debug Mode)
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$sourcePath
Environment="PATH=$pathEnv"
Environment="NODE_ENV=development"
Environment="PORT=$port"
ExecStart=/bin/bash -c '$devCommand'
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE;
    }

    /**
     * Refresh existing service with new configuration
     */
    public static function refreshService(string $appname, string $sourcePath, int $port, ?string $user = null): bool
    {
        $serviceName = self::getStaticServiceName($appname);

        // Stop service first
        self::stopService($serviceName);

        // Recreate service file
        $success = self::createServiceFile($appname, $sourcePath, $port, $user);

        if ($success) {
            // Restart service
            self::startService($serviceName);
        }

        return $success;
    }

    /**
     * Enable service to start on boot
     */
    public static function enableService(string $serviceName): bool
    {
        $result = Process::run("systemctl enable $serviceName");

        if ($result->failed()) {
            Log::error('Failed to enable static app service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Enabled static app service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Disable service from starting on boot
     */
    public static function disableService(string $serviceName): bool
    {
        $result = Process::run("systemctl disable $serviceName");

        if ($result->failed()) {
            Log::error('Failed to disable static app service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Disabled static app service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Start service
     */
    public static function startService(string $serviceName): bool
    {
        $result = Process::run("systemctl start $serviceName");

        if ($result->failed()) {
            Log::error('Failed to start static app service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Started static app service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Stop service
     */
    public static function stopService(string $serviceName): bool
    {
        $result = Process::run("systemctl stop $serviceName");

        if ($result->failed()) {
            Log::error('Failed to stop static app service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Stopped static app service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Restart service
     */
    public static function restartService(string $serviceName): bool
    {
        $result = Process::run("systemctl restart $serviceName");

        if ($result->failed()) {
            Log::error('Failed to restart static app service', [
                'service_name' => $serviceName,
                'error' => $result->errorOutput()
            ]);
            return false;
        }

        Log::info('Restarted static app service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Remove service completely
     */
    public static function removeService(string $serviceName): bool
    {
        // Stop and disable service
        self::stopService($serviceName);
        self::disableService($serviceName);

        // Remove service file
        $servicePath = self::getSystemdDir() . "/$serviceName.service";
        if (file_exists($servicePath)) {
            unlink($servicePath);
        }

        // Reload systemd
        Process::run('systemctl daemon-reload');

        Log::info('Removed static app service', ['service_name' => $serviceName]);
        return true;
    }

    /**
     * Resolve duplicate services for the same app
     * Removes all but the most recent service
     */
    public static function resolveDuplicateServices(string $appname): array
    {
        $allServices = self::listStaticServices();
        $duplicates = [];

        foreach ($allServices as $service) {
            // Check if this service matches our app name pattern
            if (str_contains($service, $appname)) {
                $expectedName = self::getStaticServiceName($appname);
                if ($service !== $expectedName) {
                    $duplicates[] = $service;
                    self::removeService($service);
                }
            }
        }

        return $duplicates;
    }

    /**
     * Get service logs
     */
    public static function getServiceLogs(string $serviceNameOrAppname, int $lines = 50): string
    {
        $serviceName = str_starts_with($serviceNameOrAppname, self::STATIC_SERVICE_PREFIX)
            ? $serviceNameOrAppname
            : self::getStaticServiceName($serviceNameOrAppname);

        $result = Process::run("journalctl -u $serviceName -n $lines --no-pager");

        return $result->output();
    }
}
