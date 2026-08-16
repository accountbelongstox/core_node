<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1StaticResourceAnalyzer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ServerManagerV1SystemInfoCtl extends ServerManagerV1BaseCtl
{
    /**
     * Get complete system information
     */
    public function getSystemInfo(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_info');
        if ($validation) {
            return $validation;
        }

        try {
            $systemInfo = [
                'basic_info' => $this->getBasicSystemInfo(),
                'laravel_info' => $this->getLaravelInfo(),
                'php_config' => $this->getPhpConfig(),
                'hardware_info' => $this->getHardwareInfo(),
                'network_info' => $this->getNetworkInfo(),
                'directory_status' => $this->getDirectoryStatus(),
                'service_status' => $this->getServiceStatus(),
                'nginx_analysis' => $this->getNginxAnalysis(),
                'system_status' => $this->getSystemStatus()
            ];

            return $this->success($systemInfo, 'System information retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_info');
        }
    }

    /**
     * Laravel application info block consumed by the SystemInfo "Laravel Info"
     * card (environment, debug, urls, locale, and cache state).
     */
    private function getLaravelInfo(): array
    {
        $app = app();

        return [
            'environment' => $app->environment(),
            'debug_mode' => (bool) config('app.debug'),
            'app_url' => config('app.url'),
            'app_name' => config('app.name'),
            'laravel_version' => $app->version(),
            'locale' => $app->getLocale(),
            'cache_info' => [
                'config_cached' => $app->configurationIsCached(),
                'routes_cached' => $app->routesAreCached(),
                'events_cached' => $app->eventsAreCached(),
                'views_cached' => count(glob($app->storagePath('framework/views/*.php')) ?: []) > 0,
            ],
        ];
    }

    /**
     * Get running processes
     */
    public function getProcesses(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'processes');
        if ($validation) {
            return $validation;
        }
        
        try {
            $result = ServerManagerV1Utils::executeCommand('ps', ['aux']);
            
            if (!$result['success']) {
                return $this->error('Failed to retrieve process list');
            }
            
            $processes = $this->parseProcessList($result['output']);
            
            return $this->success([
                'processes' => $processes,
                'total_count' => count($processes)
            ], 'Process list retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'processes');
        }
    }
    
    /**
     * Get system services status
     */
    public function getServices(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'services');
        if ($validation) {
            return $validation;
        }

        try {
            // System services
            $systemServices = [
                'nginx' => $this->getServiceInfo('nginx'),
                'php-fpm' => $this->getServiceInfo('php8.2-fpm'),
                'mysql' => $this->getServiceInfo('mysql'),
                'redis' => $this->getServiceInfo('redis'),
                'certbot' => $this->getCertbotStatus()
            ];

            // Get all unified manager applications
            $unifiedApps = $this->getUnifiedManagerApps();

            // Get Octane services
            $octaneServices = $this->getOctaneServices();

            $response = [
                'system_services' => $systemServices,
                'octane_services' => $octaneServices,
                'application_services' => $unifiedApps,
                'total_services' => count($systemServices) + count($octaneServices) + count($unifiedApps),
                'summary' => [
                    'system_running' => $this->countRunningServices($systemServices),
                    'system_total' => count($systemServices),
                    'octane_running' => $this->countRunningServices($octaneServices),
                    'octane_total' => count($octaneServices),
                    'apps_running' => $this->countRunningServices($unifiedApps),
                    'apps_total' => count($unifiedApps)
                ]
            ];

            return $this->success($response, 'Service status retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'services');
        }
    }

    /**
     * Get Octane services
     */
    private function getOctaneServices(): array
    {
        $services = [];

        // Find all octane services
        $result = ServerManagerV1Utils::executeCommand('systemctl', ['list-units', '--type=service', '--all', '--no-pager', 'octane-*']);

        if ($result['success']) {
            $lines = explode("\n", $result['output']);
            foreach ($lines as $line) {
                if (preg_match('/^\s*(octane-[^\s]+\.service)/', $line, $matches)) {
                    $serviceName = str_replace('.service', '', $matches[1]);
                    $services[$serviceName] = $this->getDetailedServiceInfo($serviceName);
                }
            }
        }

        return $services;
    }

    /**
     * Get unified manager application services
     */
    private function getUnifiedManagerApps(): array
    {
        $services = [];

        // Find all app services (app-, pyapp-, webapp-)
        $prefixes = ['app-', 'pyapp-', 'webapp-'];

        foreach ($prefixes as $prefix) {
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['list-units', '--type=service', '--all', '--no-pager', $prefix . '*']);

            if ($result['success']) {
                $lines = explode("\n", $result['output']);
                foreach ($lines as $line) {
                    if (preg_match('/^\s*(' . preg_quote($prefix) . '[^\s]+\.service)/', $line, $matches)) {
                        $serviceName = str_replace('.service', '', $matches[1]);
                        $services[$serviceName] = $this->getDetailedServiceInfo($serviceName);
                    }
                }
            }
        }

        return $services;
    }

    /**
     * Get detailed service information
     */
    private function getDetailedServiceInfo(string $serviceName): array
    {
        $statusResult = ServerManagerV1Utils::executeCommand('systemctl', ['status', $serviceName, '--no-pager']);
        $isActive = ServerManagerV1Utils::executeCommand('systemctl', ['is-active', $serviceName]);
        $isEnabled = ServerManagerV1Utils::executeCommand('systemctl', ['is-enabled', $serviceName]);

        $info = [
            'name' => $serviceName,
            'active' => trim($isActive['output']) === 'active',
            'enabled' => trim($isEnabled['output']) === 'enabled',
            'status' => trim($isActive['output']),
            'pid' => null,
            'uptime' => null,
            'memory' => null
        ];

        // Parse status output for additional details
        if ($statusResult['success'] && !empty($statusResult['output'])) {
            // Extract PID
            if (preg_match('/Main PID:\s*(\d+)/', $statusResult['output'], $matches)) {
                $info['pid'] = (int)$matches[1];
            }

            // Extract memory
            if (preg_match('/Memory:\s*([^\s]+)/', $statusResult['output'], $matches)) {
                $info['memory'] = $matches[1];
            }

            // Extract uptime/start time
            if (preg_match('/Active:\s+active[^\n]*since\s+([^\n]+)/', $statusResult['output'], $matches)) {
                $info['uptime'] = trim($matches[1]);
            }
        }

        return $info;
    }

    /**
     * Count running services
     */
    private function countRunningServices(array $services): int
    {
        $count = 0;
        foreach ($services as $service) {
            if (isset($service['active']) && $service['active'] === true) {
                $count++;
            }
        }
        return $count;
    }
    
    /**
     * Check directory permissions
     */
    public function getPermissions(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'permissions');
        if ($validation) {
            return $validation;
        }
        
        try {
            $permissions = $this->getDirectoryPermissions();
            
            return $this->success($permissions, 'Directory permissions retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'permissions');
        }
    }
    
    /**
     * Get storage analysis
     */
    public function getStorage(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'storage');
        if ($validation) {
            return $validation;
        }
        
        try {
            $storage = [
                'disk_usage' => $this->getDiskUsageDetailed(),
                'directory_sizes' => $this->getDirectorySizes(),
                'database_info' => $this->getDatabaseInfo(),
                'log_sizes' => $this->getLogSizes()
            ];
            
            return $this->success($storage, 'Storage analysis retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'storage');
        }
    }

    /**
     * Static resources summary (laravel_db/static — audio, video, images, etc.)
     */
    public function getStaticResources(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'static_resources');
        if ($validation) {
            return $validation;
        }

        try {
            $analyzer = new ServerManagerV1StaticResourceAnalyzer();
            $summary = $analyzer->analyze();
            $summary['disk_usage'] = $this->getDiskUsageDetailed();

            return $this->success($summary, 'Static resources summary retrieved successfully');
        } catch (\Exception $e) {
            return $this->handleException($e, 'static_resources');
        }
    }

    /**
     * List files in a static subdirectory with search, sort, pagination.
     */
    public function listStaticResourceFiles(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'static_resource_files');
        if ($validation) {
            return $validation;
        }

        try {
            $analyzer = new ServerManagerV1StaticResourceAnalyzer();
            $result = $analyzer->listFiles(
                (string) $request->input('path', ''),
                (string) $request->input('q', ''),
                (string) $request->input('sort', 'name'),
                (string) $request->input('order', 'asc'),
                max(1, (int) $request->input('page', 1)),
                max(10, min(500, (int) $request->input('per_page', 100)))
            );

            return $this->success($result, 'Static resource files retrieved successfully');
        } catch (\Exception $e) {
            return $this->handleException($e, 'static_resource_files');
        }
    }
    
    /**
     * Get basic system information
     */
    private function getBasicSystemInfo(): array
    {
        $info = ServerManagerV1Utils::getSystemInfo();
        
        return [
            'hostname' => $info['hostname'],
            'operating_system' => $info['uname'],
            'php_version' => $info['php_version'],
            'laravel_version' => $info['laravel_version'],
            'server_time' => now()->toISOString(),
            'timezone' => config('app.timezone'),
            'uptime' => $info['uptime']
        ];
    }

    /**
     * Get PHP configuration
     */
    private function getPhpConfig(): array
    {
        return [
            'version' => PHP_VERSION,
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'timezone' => ini_get('date.timezone') ?: date_default_timezone_get(),
            'display_errors' => (bool) ini_get('display_errors'),
            'error_reporting' => ini_get('error_reporting'),
            'extensions' => get_loaded_extensions()
        ];
    }

    /**
     * Get hardware information
     */
    private function getHardwareInfo(): array
    {
        $cpuInfo = ServerManagerV1Utils::executeCommand('cat', ['/proc/cpuinfo']);
        $memInfo = ServerManagerV1Utils::executeCommand('cat', ['/proc/meminfo']);
        
        return [
            'cpu_info' => $this->parseCpuInfo($cpuInfo['output']),
            'memory_info' => $this->parseMemoryInfo($memInfo['output']),
            'load_average' => sys_getloadavg()
        ];
    }
    
    /**
     * Get network information
     */
    private function getNetworkInfo(): array
    {
        $interfaces = ServerManagerV1Utils::executeCommand('ip', ['addr', 'show']);
        
        return [
            'interfaces' => $this->parseNetworkInterfaces($interfaces['output']),
            'hostname' => gethostname(),
            'dns_servers' => $this->getDnsServers()
        ];
    }
    
    /**
     * Get directory status for important directories
     */
    private function getDirectoryStatus(): array
    {
        $directories = [];

        foreach (ServerManagerV1Constants::getSystemDirs() as $name => $path) {
            $directories[$name] = [
                'path' => $path,
                'exists' => is_dir($path),
                'readable' => is_readable($path),
                'writable' => is_writable($path),
                'size' => $this->getDirectorySize($path)
            ];
        }

        return $directories;
    }

    /**
     * Get service status for system information
     */
    private function getServiceStatus(): array
    {
        $services = [
            'nginx' => $this->getServiceInfo('nginx'),
            'php-fpm' => $this->getServiceInfo('php8.2-fpm'),
            'mysql' => $this->getServiceInfo('mysql'),
            'redis' => $this->getServiceInfo('redis'),
            'certbot' => $this->getCertbotStatus()
        ];

        return $services;
    }
    
    /**
     * Get service status information
     */
    private function getServiceInfo(string $serviceName): array
    {
        $status = ServerManagerV1Utils::executeCommand('systemctl', ['status', $serviceName]);
        $isActive = ServerManagerV1Utils::executeCommand('systemctl', ['is-active', $serviceName]);
        $isEnabled = ServerManagerV1Utils::executeCommand('systemctl', ['is-enabled', $serviceName]);
        
        return [
            'name' => $serviceName,
            'active' => trim($isActive['output']) === 'active',
            'enabled' => trim($isEnabled['output']) === 'enabled',
            'status_output' => $status['output']
        ];
    }
    
    /**
     * Get Certbot status
     */
    private function getCertbotStatus(): array
    {
        $certbotExists = ServerManagerV1Utils::executeCommand('which', ['certbot']);
        $version = '';
        
        if ($certbotExists['success']) {
            $versionResult = ServerManagerV1Utils::executeCommand('certbot', ['--version']);
            $version = trim($versionResult['output']);
        }
        
        return [
            'installed' => $certbotExists['success'],
            'version' => $version,
            'config_file' => ServerManagerV1Constants::getCertbotInstallScript()
        ];
    }
    
    /**
     * Get Nginx analysis from temp file
     */
    private function getNginxAnalysis(): array
    {
        // Use PathMapper for environment-aware path (no hardcoded paths)
        $wwwroot = \App\Providers\PathMapper::mapWebPath('wwwroot');
        $nginxInfoFile = "$wwwroot/core_node/temp_nginx_info.txt";
        
        if (!file_exists($nginxInfoFile)) {
            return ['status' => 'Analysis file not found'];
        }
        
        $content = file_get_contents($nginxInfoFile);
        
        return [
            'analysis_available' => true,
            'analysis_content' => $content,
            'multiple_instances' => strpos($content, 'nginx: master process') !== false
        ];
    }
    
    /**
     * Parse process list output
     */
    private function parseProcessList(string $output): array
    {
        $lines = explode("\n", trim($output));
        $processes = [];
        
        // Skip header line
        for ($i = 1; $i < count($lines); $i++) {
            $line = trim($lines[$i]);
            if (empty($line)) continue;
            
            $parts = preg_split('/\s+/', $line, 11);
            if (count($parts) >= 11) {
                $processes[] = [
                    'user' => $parts[0],
                    'pid' => (int)$parts[1],
                    'cpu' => (float)$parts[2],
                    'memory' => (float)$parts[3],
                    'command' => $parts[10]
                ];
            }
        }
        
        return $processes;
    }
    
    /**
     * Parse CPU information
     */
    private function parseCpuInfo(string $output): array
    {
        $lines = explode("\n", $output);
        $cpuCount = 0;
        $modelName = 'Unknown';
        
        foreach ($lines as $line) {
            if (strpos($line, 'processor') === 0) {
                $cpuCount++;
            } elseif (strpos($line, 'model name') === 0) {
                $modelName = trim(explode(':', $line)[1]);
            }
        }
        
        return [
            'model' => $modelName,
            'cores' => $cpuCount
        ];
    }
    
    /**
     * Parse memory information
     */
    private function parseMemoryInfo(string $output): array
    {
        $lines = explode("\n", $output);
        $memInfo = [];
        
        foreach ($lines as $line) {
            if (preg_match('/^(\w+):\s+(\d+)\s+kB/', $line, $matches)) {
                $memInfo[strtolower($matches[1])] = (int)$matches[2] * 1024; // Convert to bytes
            }
        }
        
        return [
            'total' => $memInfo['memtotal'] ?? 0,
            'free' => $memInfo['memfree'] ?? 0,
            'available' => $memInfo['memavailable'] ?? 0,
            'used' => ($memInfo['memtotal'] ?? 0) - ($memInfo['memfree'] ?? 0)
        ];
    }
    
    /**
     * Parse network interfaces
     */
    private function parseNetworkInterfaces(string $output): array
    {
        // Simplified network interface parsing
        $interfaces = [];
        $lines = explode("\n", $output);
        
        foreach ($lines as $line) {
            if (preg_match('/^\d+:\s+(\w+):/', $line, $matches)) {
                $interfaces[] = $matches[1];
            }
        }
        
        return $interfaces;
    }
    
    /**
     * Get DNS servers
     */
    private function getDnsServers(): array
    {
        $result = ServerManagerV1Utils::executeCommand('cat', ['/etc/resolv.conf']);
        $dns = [];
        
        if ($result['success']) {
            $lines = explode("\n", $result['output']);
            foreach ($lines as $line) {
                if (strpos($line, 'nameserver') === 0) {
                    $dns[] = trim(explode(' ', $line)[1]);
                }
            }
        }
        
        return $dns;
    }
    
    /**
     * Get directory size
     */
    private function getDirectorySize(string $path): int
    {
        if (!is_dir($path)) {
            return 0;
        }
        
        $result = ServerManagerV1Utils::executeCommand('du', ['-sb', $path]);
        if ($result['success']) {
            $parts = explode("\t", $result['output']);
            return (int)($parts[0] ?? 0);
        }
        
        return 0;
    }
    
    /**
     * Get detailed disk usage
     */
    private function getDiskUsageDetailed(): array
    {
        $result = ServerManagerV1Utils::executeCommand('df', ['-h']);
        $diskInfo = [];
        
        if ($result['success']) {
            $lines = explode("\n", trim($result['output']));
            for ($i = 1; $i < count($lines); $i++) {
                $parts = preg_split('/\s+/', $lines[$i]);
                if (count($parts) >= 6) {
                    $diskInfo[] = [
                        'filesystem' => $parts[0],
                        'size' => $parts[1],
                        'used' => $parts[2],
                        'available' => $parts[3],
                        'use_percent' => $parts[4],
                        'mounted_on' => $parts[5]
                    ];
                }
            }
        }
        
        return $diskInfo;
    }
    
    /**
     * Get directory sizes for important directories
     */
    private function getDirectorySizes(): array
    {
        $sizes = [];
        
        foreach (ServerManagerV1Constants::getSystemDirs() as $name => $path) {
            $sizes[$name] = [
                'path' => $path,
                'size_bytes' => $this->getDirectorySize($path),
                'size_human' => ServerManagerV1Utils::formatFileSize($this->getDirectorySize($path))
            ];
        }
        
        return $sizes;
    }
    
    /**
     * Get database information
     */
    private function getDatabaseInfo(): array
    {
        $dbPath = ServerManagerV1Constants::getSystemDirs()['laravel_db'];
        $dbFile = $dbPath . '/database.sqlite';
        
        return [
            'database_directory' => $dbPath,
            'database_file' => $dbFile,
            'exists' => file_exists($dbFile),
            'size' => file_exists($dbFile) ? filesize($dbFile) : 0,
            'readable' => is_readable($dbFile),
            'writable' => is_writable($dbFile)
        ];
    }
    
    /**
     * Get log file sizes
     */
    private function getLogSizes(): array
    {
        $logDirs = [
            '/var/log/nginx',
            '/var/log/apache2',
            '/var/log/php',
            storage_path('logs')
        ];
        
        $logInfo = [];
        
        foreach ($logDirs as $dir) {
            if (is_dir($dir)) {
                $logInfo[basename($dir)] = [
                    'path' => $dir,
                    'size_bytes' => $this->getDirectorySize($dir),
                    'size_human' => ServerManagerV1Utils::formatFileSize($this->getDirectorySize($dir))
                ];
            }
        }
        
        return $logInfo;
    }
    
    /**
     * Get directory permissions for important directories
     */
    private function getDirectoryPermissions(): array
    {
        $permissions = [];
        
        foreach (ServerManagerV1Constants::getSystemDirs() as $name => $path) {
            if (file_exists($path)) {
                $perms = fileperms($path);
                $permissions[$name] = [
                    'path' => $path,
                    'permissions' => substr(sprintf('%o', $perms), -4),
                    'readable' => is_readable($path),
                    'writable' => is_writable($path),
                    'executable' => is_executable($path)
                ];
            }
        }
        
        return $permissions;
    }
}
