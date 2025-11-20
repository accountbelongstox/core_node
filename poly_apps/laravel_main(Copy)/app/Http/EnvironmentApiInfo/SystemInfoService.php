<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\EnvironmentApiInfo;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SystemInfoService
{
    /**
     * Gathers comprehensive system, environment, and application information.
     */
    public function getDetails(): array
    {
        return [
            'core_information' => $this->getCoreInformation(),
            'laravel_configuration_summary' => $this->getLaravelConfigurationSummary(),
            'applications_overview' => $this->getApplicationsOverview(),
            'php_configuration' => $this->getPhpConfiguration(),
            'database_information' => $this->getDatabaseInformation(),
            'system_resources' => $this->getSystemResources(),
            'system_information' => $this->getSystemInformation(),
            'external_tools' => $this->getExternalToolsVersions(),
        ];
    }

    private function getCoreInformation(): array
    {
        return [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'environment' => app()->environment(),
            'debug_mode' => config('app.debug') ? 'Enabled' : 'Disabled',
            'timezone' => config('app.timezone'),
        ];
    }

    private function getLaravelConfigurationSummary(): array
    {
        return [
            'application_mode' => 'Headless API (Web routes preserved for debugging)',
            'database_connections' => $this->getDatabaseConnections(),
            'external_storage_paths' => $this->getExternalStoragePaths(),
            'cache_driver' => config('cache.default', 'not_set'),
            'session_driver' => config('session.driver', 'not_set'),
            'queue_driver' => config('queue.default', 'not_set'),
            'mail_driver' => config('mail.default', 'not_set'),
            'logging_channels' => $this->getLoggingChannels(),
            'middleware_groups' => $this->getMiddlewareGroups(),
            'route_files' => $this->getRouteFiles()
        ];
    }

    private function getApplicationsOverview(): array
    {
        $apps = $this->scanApplications();
        $totalApis = 0;
        $appDetails = [];

        foreach ($apps as $appName) {
            $apiCount = $this->countAppAPIs($appName);
            $appDetails[$appName] = [
                'api_count' => $apiCount,
                'status' => 'active'
            ];
            $totalApis += $apiCount;
        }

        return [
            'total_applications' => count($apps),
            'total_apis_across_all_apps' => $totalApis,
            'applications' => $appDetails
        ];
    }

    private function getPhpConfiguration(): array
    {
        return [
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time') . 's',
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'display_errors' => ini_get('display_errors') ? 'On' : 'Off',
            'command_execution_enabled' => $this->isShellExecEnabled(),
        ];
    }

    private function getDatabaseInformation(): array
    {
        try {
            DB::connection()->getPdo();
            $connectionName = DB::connection()->getDriverName();
            $databaseName = DB::connection()->getDatabaseName();
            $version = DB::connection()->getPdo()->getAttribute(\PDO::ATTR_SERVER_VERSION);
            $status = 'Connected';
        } catch (\Exception $e) {
            $connectionName = config('database.default');
            $databaseName = config("database.connections.{$connectionName}.database", 'N/A');
            $version = 'N/A';
            $status = 'Error: ' . $e->getMessage();
        }

        return [
            'status' => $status,
            'connection_driver' => $connectionName,
            'database_name' => $databaseName,
            'database_version' => $version,
        ];
    }

    private function getSystemResources(): array
    {
        return [
            'cpu_usage' => $this->getCpuUsage(),
            'memory_usage' => $this->getMemoryUsage(),
            'disk_usage' => $this->getDiskUsage(),
            'load_average' => $this->getLoadAverage(),
        ];
    }

    private function getSystemInformation(): array
    {
        return [
            'os' => PHP_OS,
            'architecture' => php_uname('m'),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'server_ip' => $_SERVER['SERVER_ADDR'] ?? 'Unknown',
        ];
    }

    private function getExternalToolsVersions(): array
    {
        $tools = [
            'git' => 'git --version',
            'node' => 'node -v',
            'python' => 'python --version',
            'go' => 'go version',
            'curl' => 'curl --version',
            '7z' => '7z',
            'ffmpeg' => 'ffmpeg -version',
        ];

        if (!$this->isShellExecEnabled()) {
            return array_map(fn($cmd) => 'Shell Exec Disabled', $tools);
        }

        $versions = [];
        foreach ($tools as $tool => $command) {
            $versions[$tool] = $this->executeCommand($command) ?: 'Not Found';
        }
        return $versions;
    }

    private function isShellExecEnabled(): bool
    {
        return function_exists('shell_exec') && !in_array('shell_exec', array_map('trim', explode(',', ini_get('disable_functions'))));
    }

    private function executeCommand(string $command): ?string
    {
        try {
            $output = shell_exec("$command 2>&1");
            return $output ? trim($output) : null;
        } catch (\Exception $e) {
            Log::warning("Command execution failed for '{$command}': " . $e->getMessage());
            return null;
        }
    }

    private function getCpuUsage(): string
    {
        if (!$this->isShellExecEnabled()) return 'N/A';

        if (PHP_OS_FAMILY === 'Windows') {
            $output = $this->executeCommand('wmic cpu get loadpercentage');
            if ($output && preg_match('/\d+/', $output, $matches)) {
                return $matches[0] . '%';
            }
        } else {
            $load = sys_getloadavg();
            return $load[0] . '% (1 min), ' . $load[1] . '% (5 min), ' . $load[2] . '% (15 min)';
        }
        return 'N/A';
    }

    private function getMemoryUsage(): string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            if (!$this->isShellExecEnabled()) return 'N/A';
            $output = $this->executeCommand('wmic OS get FreePhysicalMemory, TotalVisibleMemorySize');
            if (preg_match('/(\d+)\s+(\d+)/', $output, $matches)) {
                $total = $matches[2] * 1024;
                $free = $matches[1] * 1024;
                $used = $total - $free;
                return sprintf('%s / %s (%.2f%%)', $this->formatBytes($used), $this->formatBytes($total), ($used / $total) * 100);
            }
        } else {
            if (is_readable('/proc/meminfo')) {
                $meminfo = file_get_contents('/proc/meminfo');
                preg_match('/MemTotal:\s+(\d+)\s*kB/', $meminfo, $totalMatch);
                preg_match('/MemAvailable:\s+(\d+)\s*kB/', $meminfo, $availableMatch);
                if (isset($totalMatch[1], $availableMatch[1])) {
                    $total = $totalMatch[1] * 1024;
                    $available = $availableMatch[1] * 1024;
                    $used = $total - $available;
                    return sprintf('%s / %s (%.2f%%)', $this->formatBytes($used), $this->formatBytes($total), ($used / $total) * 100);
                }
            }
        }
        return 'N/A';
    }

    private function getDiskUsage(): string
    {
        $path = base_path();
        if (function_exists('disk_free_space') && function_exists('disk_total_space')) {
            $free = disk_free_space($path);
            $total = disk_total_space($path);
            $used = $total - $free;
            return sprintf('%s / %s (%.2f%%)', $this->formatBytes($used), $this->formatBytes($total), ($used / $total) * 100);
        }
        return 'N/A';
    }

    private function getLoadAverage(): string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return 'N/A on Windows';
        }
        if (function_exists('sys_getloadavg')) {
            return implode(', ', sys_getloadavg());
        }
        return 'N/A';
    }

    private function formatBytes(int $bytes, int $precision = 2): string
    {
        if ($bytes === 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $log = log($bytes, 1024);
        $pow = floor($log);
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));
        return round($bytes, $precision) . ' ' . $units[$pow];
    }

    private function getDatabaseConnections(): array
    {
        $connections = config('database.connections', []);
        $summary = [];
        
        foreach ($connections as $name => $config) {
            $summary[$name] = [
                'driver' => $config['driver'] ?? 'unknown',
                'database' => $config['database'] ?? 'not_set'
            ];
        }
        
        return [
            'default_connection' => config('database.default', 'not_set'),
            'configured_connections' => count($connections),
            'connections' => $summary
        ];
    }

    private function getExternalStoragePaths(): array
    {
        return [
            'public_path_external' => 'Configured outside project directory for deployment flexibility',
            'storage_path_external' => 'Configured outside project directory for shared storage',
            'uploads_path' => 'External path for user uploads and media files',
            'temp_path' => 'External temporary file processing location'
        ];
    }

    private function getLoggingChannels(): array
    {
        $channels = config('logging.channels', []);
        return [
            'default_channel' => config('logging.default', 'not_set'),
            'configured_channels' => array_keys($channels),
            'total_channels' => count($channels)
        ];
    }

    private function getMiddlewareGroups(): array
    {
        $middleware = config('app.middleware', []);
        $middlewareGroups = config('app.middleware_groups', []);
        
        return [
            'global_middleware_count' => count($middleware),
            'middleware_groups' => array_keys($middlewareGroups),
            'total_groups' => count($middlewareGroups)
        ];
    }

    private function getRouteFiles(): array
    {
        $routeFiles = [];
        $routesPath = base_path('routes');
        
        if (is_dir($routesPath)) {
            $files = scandir($routesPath);
            foreach ($files as $file) {
                if (str_ends_with($file, '.php')) {
                    $routeFiles[] = $file;
                }
            }
        }
        
        // Check for app-specific route directories
        $appRouteDirs = [];
        $appsPath = app_path('Apps');
        if (is_dir($appsPath)) {
            $apps = scandir($appsPath);
            foreach ($apps as $app) {
                if ($app !== '.' && $app !== '..' && is_dir($appsPath . '/' . $app)) {
                    $routeDir = $routesPath . '/' . $app . 'Router';
                    if (is_dir($routeDir)) {
                        $appRouteDirs[] = $app . 'Router/';
                    }
                }
            }
        }
        
        return [
            'main_route_files' => $routeFiles,
            'app_specific_route_directories' => $appRouteDirs,
            'total_route_files' => count($routeFiles),
            'total_app_route_dirs' => count($appRouteDirs)
        ];
    }

    private function scanApplications(): array
    {
        $apps = [];
        $appsPath = app_path('Apps');
        
        if (is_dir($appsPath)) {
            $directories = scandir($appsPath);
            foreach ($directories as $dir) {
                if ($dir !== '.' && $dir !== '..' && is_dir($appsPath . '/' . $dir)) {
                    // Check if ApiInfo file exists
                    $apiInfoFile = $appsPath . '/' . $dir . '/' . $dir . 'ApiInfo.php';
                    if (file_exists($apiInfoFile)) {
                        $apps[] = $dir;
                    }
                }
            }
        }
        
        return $apps;
    }

    private function countAppAPIs(string $appName): int
    {
        try {
            $apiInfoClass = "\\App\\Apps\\{$appName}\\{$appName}ApiInfo";
            
            if (class_exists($apiInfoClass)) {
                $apiInfoInstance = new $apiInfoClass();
                
                if (method_exists($apiInfoInstance, 'getDetails')) {
                    $data = $apiInfoInstance->getDetails();
                } elseif (method_exists($apiInfoClass, 'getApiInfo')) {
                    $data = $apiInfoClass::getApiInfo();
                } else {
                    return 0;
                }
                
                // Count APIs in the data
                if (isset($data['endpoints']) && is_array($data['endpoints'])) {
                    return count($data['endpoints']);
                } elseif (isset($data['apis']) && is_array($data['apis'])) {
                    return count($data['apis']);
                } elseif (isset($data['legacy_api_documentation']['apis']) && is_array($data['legacy_api_documentation']['apis'])) {
                    return count($data['legacy_api_documentation']['apis']);
                }
            }
            
            return 0;
        } catch (\Exception $e) {
            return 0;
        }
    }
}
