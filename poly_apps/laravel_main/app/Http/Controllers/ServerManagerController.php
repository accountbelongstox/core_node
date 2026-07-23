<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1OctaneServiceManager;

/**
 * Server Manager Controller
 * Manages systemd services via API (local access only)
 * Uses standardized ApiResponse trait
 * NO try-catch blocks - trust Laravel validation and database operations
 */
class ServerManagerController extends Controller
{
    use ApiResponse;

    private const UNIFIED_PREFIXES = ['app-', 'pyapp-', 'webapp-', 'nuxt-', 'laravel-', 'flutter-', 'react-', 'vue-'];

    /**
     * List all services created by unified_manager
     */
    public function listServices(): JsonResponse
    {
        $services = [];

        foreach (self::UNIFIED_PREFIXES as $prefix) {
            $output = [];
            $command = "systemctl list-unit-files --type=service --no-pager --no-legend 2>/dev/null | grep -E '^{$prefix}[^[:space:]]+\.service' | awk '{print \$1}' | sed 's/.service$//'";
            exec($command, $output);

            foreach ($output as $service) {
                if (!empty($service)) {
                    $services[] = [
                        'name' => $service,
                        'status' => $this->getServiceStatus($service),
                        'enabled' => $this->isServiceEnabled($service),
                    ];
                }
            }
        }

        return $this->success(['services' => $services], 'Services list retrieved successfully');
    }

    /**
     * Get service status
     */
    public function getStatus(string $serviceName): JsonResponse
    {
        $serviceName = $this->validatedServiceName($serviceName);

        $status = $this->getServiceStatus($serviceName);
        $enabled = $this->isServiceEnabled($serviceName);

        return $this->success([
            'service_name' => $serviceName,
            'status' => $status,
            'enabled' => $enabled,
        ], 'Service status retrieved successfully');
    }

    /**
     * Start service
     */
    public function startService(string $serviceName): JsonResponse
    {
        return $this->controlService($serviceName, 'start', true);
    }

    /**
     * Stop service
     */
    public function stopService(string $serviceName): JsonResponse
    {
        return $this->controlService($serviceName, 'stop');
    }

    /**
     * Restart service by name
     */
    public function restartService(string $serviceName): JsonResponse
    {
        return $this->controlService($serviceName, 'restart');
    }

    /**
     * Restart current Octane service (auto-detect)
     * Automatically detects service name from Laravel path
     * localhost only for security
     */
    public function restartCurrent(Request $request): JsonResponse
    {
        // Check if request is from localhost
        $allowedIps = ['127.0.0.1', '::1'];
        if (!in_array($request->ip(), $allowedIps, true)) {
            return $this->error('Access denied. This endpoint is only accessible from localhost.', 403);
        }

        $serviceName = ServerManagerV1OctaneServiceManager::getCurrentOctaneServiceName();

        if ($serviceName === null) {
            return $this->error('No Octane service found for current Laravel installation', 404);
        }

        $serviceName = $this->validatedServiceName($serviceName);

        $laravelPath = base_path();
        $escapedLaravelPath = escapeshellarg($laravelPath);
        $escapedServiceName = escapeshellarg($serviceName);
        $cacheOutput = [];
        exec("cd {$escapedLaravelPath} && php artisan config:clear 2>&1", $cacheOutput);
        exec("cd {$escapedLaravelPath} && php artisan route:clear 2>&1", $cacheOutput);
        exec("cd {$escapedLaravelPath} && php artisan cache:clear 2>&1", $cacheOutput);

        $output = [];
        $returnCode = 0;

        exec("sudo systemctl restart {$escapedServiceName} 2>&1", $output, $returnCode);

        if ($returnCode === 0) {
            return $this->success([
                'service_name' => $serviceName,
                'status' => $this->getServiceStatus($serviceName),
                'output' => implode("\n", $output),
                'cache_cleared' => true,
            ], 'Current service restarted successfully');
        }

        return $this->error('Failed to restart current service', 500, [
            'service_name' => $serviceName,
            'output' => implode("\n", $output),
        ]);
    }

    /**
     * Get service logs
     */
    public function getLogs(Request $request, string $serviceName): JsonResponse
    {
        $serviceName = $this->validatedServiceName($serviceName);
        $validated = $request->validate([
            'lines' => 'nullable|integer|min:1|max:500',
        ]);

        $lines = 50;
        if (isset($validated['lines'])) {
            $lines = $validated['lines'];
        }

        $escapedServiceName = escapeshellarg($serviceName);
        $output = [];
        exec("journalctl -u {$escapedServiceName} -n {$lines} --no-pager 2>&1", $output);

        return $this->success([
            'service_name' => $serviceName,
            'lines' => $lines,
            'logs' => implode("\n", $output),
        ], 'Service logs retrieved successfully');
    }

    /**
     * Toggle service auto-start
     */
    public function toggleAutoStart(Request $request, string $serviceName): JsonResponse
    {
        $serviceName = $this->validatedServiceName($serviceName);
        $escapedServiceName = escapeshellarg($serviceName);
        $enabled = $this->isServiceEnabled($serviceName);
        $output = [];
        $returnCode = 0;

        if ($enabled) {
            exec("sudo systemctl disable {$escapedServiceName} 2>&1", $output, $returnCode);
            $action = 'disabled';
        } else {
            exec("sudo systemctl enable {$escapedServiceName} 2>&1", $output, $returnCode);
            $action = 'enabled';
        }

        if ($returnCode === 0) {
            return $this->success([
                'service_name' => $serviceName,
                'enabled' => !$enabled,
                'action' => $action,
            ], "Auto-start {$action} successfully");
        }

        return $this->error('Failed to toggle auto-start', 500, [
            'service_name' => $serviceName,
            'output' => implode("\n", $output),
        ]);
    }

    /**
     * Get service status (internal method)
     */
    private function getServiceStatus(string $serviceName): string
    {
        $escapedServiceName = escapeshellarg($serviceName);
        $output = [];
        exec("systemctl is-active {$escapedServiceName} 2>&1", $output, $returnCode);

        if ($returnCode === 0) {
            return 'RUNNING';
        }

        $enabled = $this->isServiceEnabled($serviceName);
        if ($enabled) {
            return 'STOPPED_ENABLED';
        }

        return 'STOPPED_DISABLED';
    }

    /**
     * Check if service is enabled (internal method)
     */
    private function isServiceEnabled(string $serviceName): bool
    {
        $escapedServiceName = escapeshellarg($serviceName);
        $output = [];
        exec("systemctl is-enabled {$escapedServiceName} 2>&1", $output, $returnCode);

        return $returnCode === 0;
    }

    private function controlService(string $serviceName, string $action, bool $enableAfterSuccess = false): JsonResponse
    {
        $serviceName = $this->validatedServiceName($serviceName);
        $escapedServiceName = escapeshellarg($serviceName);
        $output = [];
        $returnCode = 0;
        $pastTense = match ($action) {
            'start' => 'started',
            'stop' => 'stopped',
            'restart' => 'restarted',
        };

        exec("sudo systemctl {$action} {$escapedServiceName} 2>&1", $output, $returnCode);

        if ($returnCode !== 0) {
            return $this->error("Failed to {$action} service", 500, [
                'service_name' => $serviceName,
                'output' => implode("\n", $output),
            ]);
        }

        if ($enableAfterSuccess) {
            exec("sudo systemctl enable {$escapedServiceName} 2>&1");
        }

        return $this->success([
            'service_name' => $serviceName,
            'status' => $this->getServiceStatus($serviceName),
            'output' => implode("\n", $output),
        ], "Service {$pastTense} successfully");
    }

    private function validatedServiceName(string $serviceName): string
    {
        $validated = validator(
            ['service_name' => $serviceName],
            ['service_name' => ['required', 'string', 'max:255', 'regex:/\A[a-zA-Z0-9][a-zA-Z0-9_.@:-]*\z/']]
        )->validate();

        return $validated['service_name'];
    }
}
