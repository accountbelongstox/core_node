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

    private const UNIFIED_PREFIXES = ['app-', 'webapp-', 'nuxt-', 'laravel-', 'flutter-', 'react-', 'vue-'];
    private const SCRIPT_PATH = '/www/programing/core_node/scripts/shells/linux/menu_itemshells/unified_app_service_manager.sh';

    /**
     * List all services created by unified_manager
     */
    public function listServices(Request $request): JsonResponse
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
    public function getStatus(Request $request, string $serviceName): JsonResponse
    {
        $validated = $request->validate([
            'service_name' => 'nullable|string',
        ]);

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
    public function startService(Request $request, string $serviceName): JsonResponse
    {
        $output = [];
        $returnCode = 0;

        exec("sudo systemctl start {$serviceName} 2>&1", $output, $returnCode);

        if ($returnCode === 0) {
            exec("sudo systemctl enable {$serviceName} 2>&1");
            return $this->success([
                'service_name' => $serviceName,
                'status' => $this->getServiceStatus($serviceName),
                'output' => implode("\n", $output),
            ], 'Service started successfully');
        }

        return $this->error('Failed to start service', 500, [
            'service_name' => $serviceName,
            'output' => implode("\n", $output),
        ]);
    }

    /**
     * Stop service
     */
    public function stopService(Request $request, string $serviceName): JsonResponse
    {
        $output = [];
        $returnCode = 0;

        exec("sudo systemctl stop {$serviceName} 2>&1", $output, $returnCode);

        if ($returnCode === 0) {
            return $this->success([
                'service_name' => $serviceName,
                'status' => $this->getServiceStatus($serviceName),
                'output' => implode("\n", $output),
            ], 'Service stopped successfully');
        }

        return $this->error('Failed to stop service', 500, [
            'service_name' => $serviceName,
            'output' => implode("\n", $output),
        ]);
    }

    /**
     * Restart service by name
     */
    public function restartService(Request $request, string $serviceName): JsonResponse
    {
        $output = [];
        $returnCode = 0;

        exec("sudo systemctl restart {$serviceName} 2>&1", $output, $returnCode);

        if ($returnCode === 0) {
            return $this->success([
                'service_name' => $serviceName,
                'status' => $this->getServiceStatus($serviceName),
                'output' => implode("\n", $output),
            ], 'Service restarted successfully');
        }

        return $this->error('Failed to restart service', 500, [
            'service_name' => $serviceName,
            'output' => implode("\n", $output),
        ]);
    }

    /**
     * Restart current Octane service (auto-detect)
     * Automatically detects service name from Laravel path
     * localhost only for security
     */
    public function restartCurrent(Request $request): JsonResponse
    {
        // Check if request is from localhost
        $allowedIps = ['127.0.0.1', '::1', 'localhost'];
        if (!in_array($request->ip(), $allowedIps) && $request->ip() !== '127.0.0.1') {
            return $this->error('Access denied. This endpoint is only accessible from localhost.', 403);
        }

        $serviceName = ServerManagerV1OctaneServiceManager::getCurrentOctaneServiceName();

        if ($serviceName === null) {
            return $this->error('No Octane service found for current Laravel installation', 404);
        }

        $laravelPath = base_path();
        $cacheOutput = [];
        exec("cd {$laravelPath} && php artisan config:clear 2>&1", $cacheOutput);
        exec("cd {$laravelPath} && php artisan route:clear 2>&1", $cacheOutput);
        exec("cd {$laravelPath} && php artisan cache:clear 2>&1", $cacheOutput);

        $output = [];
        $returnCode = 0;

        exec("sudo systemctl restart {$serviceName} 2>&1", $output, $returnCode);

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
        $validated = $request->validate([
            'lines' => 'nullable|integer|min:1|max:500',
        ]);

        $lines = 50;
        if (isset($validated['lines'])) {
            $lines = $validated['lines'];
        }

        $output = [];
        exec("journalctl -u {$serviceName} -n {$lines} --no-pager 2>&1", $output);

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
        $enabled = $this->isServiceEnabled($serviceName);
        $output = [];
        $returnCode = 0;

        if ($enabled) {
            exec("sudo systemctl disable {$serviceName} 2>&1", $output, $returnCode);
            $action = 'disabled';
        } else {
            exec("sudo systemctl enable {$serviceName} 2>&1", $output, $returnCode);
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
        $output = [];
        exec("systemctl is-active {$serviceName} 2>&1", $output, $returnCode);

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
        $output = [];
        exec("systemctl is-enabled {$serviceName} 2>&1", $output, $returnCode);

        return $returnCode === 0;
    }
}
