<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Providers\PathMapper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ServerManagerV1UnifiedManagerCtl extends ServerManagerV1BaseCtl
{
    /**
     * List applications from unified manager
     * Directly implements unified_core.py scan logic in PHP (1:1 implementation)
     */
    public function listApps(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_list_apps');
        if ($validation) {
            return $validation;
        }

        try {
            // Get root directory - use getCoreNodeDir() which returns the correct path
            $rootDir = \App\Providers\PathMapper::getCoreNodeDir();

            // Fallback if getCoreNodeDir returns null
            if (!$rootDir || !is_dir($rootDir)) {
                $rootDir = '/www/programing/core_node';
            }

            // Scan all application directories
            $apps = [];

            // Scan directories (same as unified_core.py lines 404-413)
            $appDirs = [
                ['path' => $rootDir . '/apps', 'type' => 'ncoreApp'],
                ['path' => $rootDir . '/pyapps', 'type' => 'pycoreApp'],
                ['path' => $rootDir . '/poly_apps', 'type' => 'polyApp']
            ];

            foreach ($appDirs as $dirInfo) {
                if (is_dir($dirInfo['path'])) {
                    $scannedApps = $this->scanDirectory($dirInfo['path'], $dirInfo['type'], $rootDir);
                    $apps = array_merge($apps, $scannedApps);
                }
            }

            // IMPORTANT: Global sort by name (same as unified_core.py line 417)
            // This ensures stable port assignment
            usort($apps, function($a, $b) {
                return strcasecmp($a['name'], $b['name']);
            });

            // Assign ports based on sorted index (same as unified_core.py line 318)
            $basePort = 10000;
            foreach ($apps as $index => &$app) {
                $app['port'] = $basePort + $index;
            }

            // Load service status for each app
            $this->enrichAppsWithStatus($apps);

            return $this->successResponse([
                'apps' => $apps,
                'total_apps' => count($apps),
                'base_port' => $basePort,
                'scan_timestamp' => time()
            ], 'Applications retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_list_apps');
        }
    }

    /**
     * Scan directory for applications (implements AppScanner.scan_directory)
     */
    private function scanDirectory(string $directory, string $appType, string $rootDir): array
    {
        $apps = [];

        if (!is_dir($directory)) {
            return $apps;
        }

        try {
            $items = scandir($directory);

            foreach ($items as $item) {
                if ($item === '.' || $item === '..' || $item[0] === '.') {
                    continue;
                }

                $appPath = $directory . '/' . $item;

                if (is_dir($appPath)) {
                    $appInfo = $this->scanSingleApp($appPath, $appType, $rootDir);
                    if ($appInfo) {
                        $apps[] = $appInfo;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::warning("Failed to scan directory: $directory", ['error' => $e->getMessage()]);
        }

        return $apps;
    }

    /**
     * Scan single application (implements AppScanner._scan_single_app)
     */
    private function scanSingleApp(string $appPath, string $appType, string $rootDir): ?array
    {
        // Check for valid entry points (unified_core.py line 273-279)
        if (!$this->hasValidEntryPoint($appPath)) {
            return null;
        }

        $framework = $this->detectFramework($appPath);
        $debugMode = $this->isDebugMode($appPath, $framework);

        // Convert absolute path to relative path (relative to root_dir)
        $relativePath = str_replace($rootDir . '/', '', $appPath);

        return [
            'name' => basename($appPath),
            'path' => $relativePath,  // Return relative path instead of absolute
            'type' => $appType,
            'framework' => $framework,
            'debug_mode' => $debugMode,
            'port' => 0  // Will be assigned later
        ];
    }

    /**
     * Check if app has valid entry point (unified_core.py line 271-279)
     */
    private function hasValidEntryPoint(string $appPath): bool
    {
        $entryPoints = [
            'main.py', 'main.js', 'package.json', 'composer.json',
            'pubspec.yaml', 'index.php', 'build.gradle', 'build.gradle.kts',
            'nuxt.config.js', 'nuxt.config.ts'
        ];

        foreach ($entryPoints as $entry) {
            if (file_exists($appPath . '/' . $entry)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Detect framework type (implements FrameworkDetector.detect_framework)
     * Priority order from unified_config.ini line 26
     */
    private function detectFramework(string $appPath): string
    {
        // Check React Native first (before React)
        if ($this->checkReactNative($appPath)) {
            return 'reactNativeStart';
        }

        // Check Nuxt (before Vue/React)
        if ($this->checkNuxt($appPath)) {
            return 'nuxtStart';
        }

        // Check React
        if ($this->checkReact($appPath)) {
            return 'reactStart';
        }

        // Check Vue
        if ($this->checkVue($appPath)) {
            return 'vueStart';
        }

        // Check Laravel
        if ($this->checkLaravel($appPath)) {
            return 'laravelStart';
        }

        // Check Flutter
        if ($this->checkFlutter($appPath)) {
            return 'flutterStart';
        }

        return 'polyLauncher';
    }

    private function checkReactNative(string $appPath): bool
    {
        $packageJson = $appPath . '/package.json';
        if (file_exists($packageJson) && (is_dir($appPath . '/android') || is_dir($appPath . '/ios'))) {
            $content = file_get_contents($packageJson);
            return strpos($content, 'react-native') !== false;
        }
        return false;
    }

    private function checkNuxt(string $appPath): bool
    {
        return file_exists($appPath . '/nuxt.config.ts') || file_exists($appPath . '/nuxt.config.js');
    }

    private function checkReact(string $appPath): bool
    {
        $packageJson = $appPath . '/package.json';
        if (file_exists($packageJson)) {
            $content = file_get_contents($packageJson);
            return strpos($content, 'react') !== false &&
                   strpos($content, 'react-native') === false &&
                   strpos($content, 'nuxt') === false;
        }
        return false;
    }

    private function checkVue(string $appPath): bool
    {
        $packageJson = $appPath . '/package.json';
        if (file_exists($packageJson)) {
            $content = file_get_contents($packageJson);
            return strpos($content, 'vue') !== false && strpos($content, 'nuxt') === false;
        }
        return false;
    }

    private function checkLaravel(string $appPath): bool
    {
        return file_exists($appPath . '/composer.json') &&
               file_exists($appPath . '/artisan') &&
               is_dir($appPath . '/public');
    }

    private function checkFlutter(string $appPath): bool
    {
        return file_exists($appPath . '/pubspec.yaml');
    }

    /**
     * Detect debug mode (implements FrameworkDetector.is_debug_mode)
     */
    private function isDebugMode(string $appPath, string $framework): bool
    {
        // Check environment files (unified_core.py line 183-195)
        $envFiles = ['.env', '.env.local', '.env.development'];
        $envPatterns = ['APP_ENV=local', 'NODE_ENV=development', 'APP_DEBUG=true'];

        foreach ($envFiles as $envFile) {
            $envPath = $appPath . '/' . $envFile;
            if (file_exists($envPath)) {
                $content = file_get_contents($envPath);
                foreach ($envPatterns as $pattern) {
                    if (strpos($content, $pattern) !== false) {
                        return true;
                    }
                }
            }
        }

        // Check framework-specific indicators (unified_core.py line 198-201)
        if (in_array($framework, ['reactStart', 'vueStart', 'nuxtStart'])) {
            if (file_exists($appPath . '/vite.config.ts') || file_exists($appPath . '/vite.config.js')) {
                return true;
            }
        }

        // Check workspace patterns (unified_core.py line 211-214)
        $workspacePatterns = ['poly_apps', 'dev', 'development'];
        foreach ($workspacePatterns as $pattern) {
            if (strpos($appPath, $pattern) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Enrich apps with service status information
     */
    private function enrichAppsWithStatus(array &$apps): void
    {
        foreach ($apps as &$app) {
            $serviceName = $this->getServiceName($app['name'], $app['type']);

            // Check systemd service status
            $serviceStatus = $this->checkSystemdService($serviceName);

            // Check launcher script
            $launcherPath = "/var/_core_node/unified_manager/temp_scripts/{$serviceName}.sh";
            $launcherExists = file_exists($launcherPath);

            // Build status info
            $app['service_status'] = [
                'installed' => $serviceStatus['exists'],
                'service_name' => $serviceName,
                'status' => $serviceStatus['status'], // running, stopped, failed, not_installed
                'enabled' => $serviceStatus['enabled'],
                'launcher_exists' => $launcherExists,
                'launcher_path' => $launcherExists ? $launcherPath : null,
                'pid' => $serviceStatus['pid'],
                'uptime' => $serviceStatus['uptime']
            ];
        }
    }

    /**
     * Get systemd service name based on app type
     */
    private function getServiceName(string $appName, string $appType): string
    {
        // ncoreApp and pycoreApp use different naming
        if ($appType === 'ncoreApp') {
            return "app-{$appName}";
        } elseif ($appType === 'pycoreApp') {
            return "pyapp-{$appName}";
        } else {
            return "webapp-{$appName}";
        }
    }

    /**
     * Check systemd service status
     */
    private function checkSystemdService(string $serviceName): array
    {
        $status = [
            'exists' => false,
            'status' => 'not_installed',
            'enabled' => false,
            'pid' => null,
            'uptime' => null
        ];

        // Check if service file exists
        $serviceFile = "/etc/systemd/system/{$serviceName}.service";
        if (!file_exists($serviceFile)) {
            return $status;
        }

        $status['exists'] = true;

        // Get service status using systemctl
        $result = ServerManagerV1Utils::executeCommand('systemctl', ['status', $serviceName, '--no-pager'], 5);

        if ($result['success']) {
            $output = $result['output'];

            // Parse status
            if (strpos($output, 'Active: active (running)') !== false) {
                $status['status'] = 'running';

                // Extract PID
                if (preg_match('/Main PID: (\d+)/', $output, $matches)) {
                    $status['pid'] = (int)$matches[1];
                }

                // Extract uptime
                if (preg_match('/Active: active \(running\) since (.+?);/', $output, $matches)) {
                    $status['uptime'] = trim($matches[1]);
                }
            } elseif (strpos($output, 'Active: inactive (dead)') !== false) {
                $status['status'] = 'stopped';
            } elseif (strpos($output, 'Active: failed') !== false) {
                $status['status'] = 'failed';
            } elseif (strpos($output, 'Active: activating') !== false) {
                $status['status'] = 'starting';
            }

            // Check if enabled
            if (strpos($output, 'Loaded:') !== false && strpos($output, 'enabled') !== false) {
                $status['enabled'] = true;
            }
        } else {
            // Service exists but status failed - likely stopped
            $status['status'] = 'stopped';
        }

        return $status;
    }

    /**
     * Start application service
     */
    public function startApp(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_start_app');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['app_name', 'app_type']);
        if ($paramValidation) {
            return $paramValidation;
        }

        try {
            $appName = $request->input('app_name');
            $appType = $request->input('app_type');
            $serviceName = $this->getServiceName($appName, $appType);

            // Check if service exists
            $serviceFile = "/etc/systemd/system/{$serviceName}.service";
            if (!file_exists($serviceFile)) {
                return $this->errorResponse("Service not installed: {$serviceName}", 404);
            }

            // Start service
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['start', $serviceName], 10);

            if (!$result['success']) {
                return $this->errorResponse("Failed to start service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            // Get updated status
            $status = $this->checkSystemdService($serviceName);

            return $this->successResponse([
                'app_name' => $appName,
                'service_name' => $serviceName,
                'status' => $status,
                'output' => $result['output']
            ], 'Service started successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_start_app');
        }
    }

    /**
     * Stop application service
     */
    public function stopApp(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_stop_app');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['app_name', 'app_type']);
        if ($paramValidation) {
            return $paramValidation;
        }

        try {
            $appName = $request->input('app_name');
            $appType = $request->input('app_type');
            $serviceName = $this->getServiceName($appName, $appType);

            // Stop service
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['stop', $serviceName], 10);

            if (!$result['success']) {
                return $this->errorResponse("Failed to stop service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            // Get updated status
            $status = $this->checkSystemdService($serviceName);

            return $this->successResponse([
                'app_name' => $appName,
                'service_name' => $serviceName,
                'status' => $status,
                'output' => $result['output']
            ], 'Service stopped successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_stop_app');
        }
    }

    /**
     * Restart application service
     */
    public function restartApp(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_restart_app');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['app_name', 'app_type']);
        if ($paramValidation) {
            return $paramValidation;
        }

        try {
            $appName = $request->input('app_name');
            $appType = $request->input('app_type');
            $serviceName = $this->getServiceName($appName, $appType);

            // Check if service exists
            $serviceFile = "/etc/systemd/system/{$serviceName}.service";
            if (!file_exists($serviceFile)) {
                return $this->errorResponse("Service not installed: {$serviceName}", 404);
            }

            // Restart service
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 10);

            if (!$result['success']) {
                return $this->errorResponse("Failed to restart service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            // Get updated status
            $status = $this->checkSystemdService($serviceName);

            return $this->successResponse([
                'app_name' => $appName,
                'service_name' => $serviceName,
                'status' => $status,
                'output' => $result['output']
            ], 'Service restarted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_restart_app');
        }
    }

    /**
     * Deploy application using unified manager
     */
    public function deployApp(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_deploy_app');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['app_name']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $appName = $request->input('app_name');
            $action = $request->input('action', 'deploy'); // deploy, start, stop, restart
            $deployScript = ServerManagerV1Constants::getUnifiedManagerScripts()['deploy_apps'];
            
            $startTime = microtime(true);
            $deploymentId = uniqid('deploy_', true);
            
            // Log deployment start
            Log::info('ServerManagerV1: Unified manager deployment started', [
                'deployment_id' => $deploymentId,
                'app_name' => $appName,
                'action' => $action,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            
            // Build command arguments
            $args = [$deployScript];
            
            switch ($action) {
                case 'deploy':
                    $args[] = '--apps';
                    $args[] = $appName;
                    break;
                case 'start':
                    $args[] = '--start';
                    $args[] = $appName;
                    break;
                case 'stop':
                    $args[] = '--stop';
                    $args[] = $appName;
                    break;
                case 'restart':
                    $args[] = '--restart';
                    $args[] = $appName;
                    break;
                default:
                    return $this->errorResponse(
                        "Invalid action: $action. Valid actions: deploy, start, stop, restart",
                        ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                    );
            }
            
            // Execute deployment
            $result = ServerManagerV1Utils::executeCommand('bash', $args, 300); // 5 minute timeout
            
            $endTime = microtime(true);
            $executionTime = $endTime - $startTime;
            
            // Prepare deployment result
            $deploymentResult = [
                'deployment_id' => $deploymentId,
                'app_name' => $appName,
                'action' => $action,
                'success' => $result['success'],
                'output' => $result['output'],
                'error_output' => $result['error'],
                'exit_code' => $result['exit_code'],
                'execution_time' => $executionTime,
                'memory_usage' => $result['memory_usage'],
                'timeout_reached' => $result['timeout_reached'] ?? false,
                'started_at' => date('Y-m-d H:i:s', $startTime),
                'completed_at' => date('Y-m-d H:i:s', $endTime)
            ];
            
            // Log deployment completion
            Log::info('ServerManagerV1: Unified manager deployment completed', [
                'deployment_id' => $deploymentId,
                'success' => $result['success'],
                'exit_code' => $result['exit_code'],
                'execution_time' => $executionTime
            ]);
            
            $message = $result['success'] 
                ? "Application $action completed successfully" 
                : "Application $action failed";
            
            return $this->successResponse($deploymentResult, $message);
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_deploy_app');
        }
    }
    
    /**
     * Get application status
     */
    public function getAppStatus(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_app_status');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['app_name', 'app_type']);
        if ($paramValidation) {
            return $paramValidation;
        }

        try {
            $appName = $request->input('app_name');
            $appType = $request->input('app_type');
            $serviceName = $this->getServiceName($appName, $appType);

            // Get service status
            $status = $this->checkSystemdService($serviceName);

            // Check launcher script
            $launcherPath = "/var/_core_node/unified_manager/temp_scripts/{$serviceName}.sh";
            $launcherExists = file_exists($launcherPath);

            return $this->successResponse([
                'app_name' => $appName,
                'app_type' => $appType,
                'service_name' => $serviceName,
                'service_status' => [
                    'installed' => $status['exists'],
                    'status' => $status['status'],
                    'enabled' => $status['enabled'],
                    'launcher_exists' => $launcherExists,
                    'launcher_path' => $launcherExists ? $launcherPath : null,
                    'pid' => $status['pid'],
                    'uptime' => $status['uptime']
                ]
            ], 'Application status retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_app_status');
        }
    }

    /**
     * Restart Octane server itself
     */
    public function restartOctane(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_restart_octane');
        if ($validation) {
            return $validation;
        }

        try {
            $serviceName = 'octane-poly-9000';

            // Restart Octane service
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 15);

            if (!$result['success']) {
                return $this->errorResponse("Failed to restart Octane: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            return $this->successResponse([
                'service_name' => $serviceName,
                'output' => $result['output']
            ], 'Octane server restarted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_restart_octane');
        }
    }

    /**
     * Reload Octane server (graceful reload without downtime)
     */
    public function reloadOctane(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_reload_octane');
        if ($validation) {
            return $validation;
        }

        try {
            $serviceName = 'octane-poly-9000';

            // Reload Octane service (graceful)
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['reload', $serviceName], 10);

            if (!$result['success']) {
                return $this->errorResponse("Failed to reload Octane: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            return $this->successResponse([
                'service_name' => $serviceName,
                'output' => $result['output']
            ], 'Octane server reloaded successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_reload_octane');
        }
    }
    
    /**
     * Get application logs
     */
    public function getAppLogs(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_app_logs');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['app_name']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $appName = $request->input('app_name');
            $lines = (int)$request->input('lines', 100);
            $lines = max(1, min(1000, $lines)); // Limit between 1 and 1000
            
            $logs = [];
            
            // Get systemd service logs
            $serviceResult = ServerManagerV1Utils::executeCommand('journalctl', [
                '-u', "ncore-$appName",
                '-n', $lines,
                '--no-pager'
            ]);
            
            if ($serviceResult['success']) {
                $serviceLines = explode("\n", trim($serviceResult['output']));
                foreach ($serviceLines as $line) {
                    if (!empty(trim($line))) {
                        $logs[] = [
                            'source' => 'systemd',
                            'line' => $line,
                            'timestamp' => $this->extractLogTimestamp($line)
                        ];
                    }
                }
            }
            
            // Get application-specific logs if they exist
            // Use PathMapper to get wwwroot path (environment-aware, no hardcoded paths)
            $wwwroot = PathMapper::mapWebPath('wwwroot');
            $appLogDir = "$wwwroot/core_node/apps/$appName/logs";
            if (is_dir($appLogDir)) {
                $logFiles = glob($appLogDir . '/*.log');
                
                foreach ($logFiles as $logFile) {
                    $fileResult = ServerManagerV1Utils::executeCommand('tail', ['-n', $lines, $logFile]);
                    
                    if ($fileResult['success']) {
                        $fileLines = explode("\n", trim($fileResult['output']));
                        foreach ($fileLines as $line) {
                            if (!empty(trim($line))) {
                                $logs[] = [
                                    'source' => basename($logFile),
                                    'line' => $line,
                                    'timestamp' => $this->extractLogTimestamp($line)
                                ];
                            }
                        }
                    }
                }
            }
            
            // Sort by timestamp if available
            usort($logs, function($a, $b) {
                if ($a['timestamp'] && $b['timestamp']) {
                    return $b['timestamp'] <=> $a['timestamp']; // Newest first
                }
                return 0;
            });
            
            return $this->successResponse([
                'app_name' => $appName,
                'logs' => $logs,
                'total_lines' => count($logs),
                'requested_lines' => $lines,
                'log_sources' => array_unique(array_column($logs, 'source'))
            ], 'Application logs retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_app_logs');
        }
    }
    

    /**
     * Get service status information
     */
    private function getServiceStatus(string $serviceName): array
    {
        $result = ServerManagerV1Utils::executeCommand('systemctl', ['status', $serviceName, '--no-pager']);

        $status = [
            'service_name' => $serviceName,
            'active' => false,
            'enabled' => false,
            'status' => 'unknown',
            'since' => null
        ];

        if ($result['success']) {
            $output = $result['output'];

            if (strpos($output, 'Active: active (running)') !== false) {
                $status['active'] = true;
                $status['status'] = 'running';
            } elseif (strpos($output, 'Active: inactive (dead)') !== false) {
                $status['status'] = 'stopped';
            } elseif (strpos($output, 'Active: failed') !== false) {
                $status['status'] = 'failed';
            }

            if (strpos($output, 'Loaded:') !== false && strpos($output, 'enabled') !== false) {
                $status['enabled'] = true;
            }

            // Extract since timestamp
            if (preg_match('/since (.+?);/', $output, $matches)) {
                $status['since'] = trim($matches[1]);
            }
        }

        return $status;
    }

    /**
     * Get process information
     */
    private function getProcessInfo(string $appName): array
    {
        $result = ServerManagerV1Utils::executeCommand('pgrep', ['-f', $appName]);

        $processInfo = [
            'running' => false,
            'pids' => [],
            'count' => 0
        ];

        if ($result['success'] && !empty(trim($result['output']))) {
            $pids = array_filter(explode("\n", trim($result['output'])));
            $processInfo['running'] = true;
            $processInfo['pids'] = $pids;
            $processInfo['count'] = count($pids);
        }

        return $processInfo;
    }

    /**
     * Get port information for application
     */
    private function getPortInfo(string $appName): array
    {
        // Common ports for different applications
        $commonPorts = [
            'laravel_main' => 8000,
            'nuxt_main' => 3000,
            'DevOps' => 8080
        ];

        $portInfo = [
            'expected_port' => $commonPorts[$appName] ?? null,
            'listening' => false,
            'port' => null
        ];

        if ($portInfo['expected_port']) {
            $result = ServerManagerV1Utils::executeCommand('netstat', ['-tlnp']);

            if ($result['success']) {
                $lines = explode("\n", $result['output']);
                foreach ($lines as $line) {
                    if (strpos($line, ":{$portInfo['expected_port']}") !== false) {
                        $portInfo['listening'] = true;
                        $portInfo['port'] = $portInfo['expected_port'];
                        break;
                    }
                }
            }
        }

        return $portInfo;
    }

    /**
     * Determine overall application status
     */
    private function determineOverallStatus(array $serviceStatus, array $processInfo): string
    {
        if ($serviceStatus['active'] && $processInfo['running']) {
            return 'running';
        } elseif ($serviceStatus['status'] === 'failed') {
            return 'failed';
        } elseif (!$serviceStatus['active'] && !$processInfo['running']) {
            return 'stopped';
        } else {
            return 'partial';
        }
    }

    /**
     * Extract timestamp from log line
     */
    private function extractLogTimestamp(string $logLine): ?int
    {
        // Try different timestamp formats
        $patterns = [
            '/^(\w{3} \d{2} \d{2}:\d{2}:\d{2})/',  // systemd format
            '/\[([^\]]+)\]/',                       // bracketed format
            '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/' // ISO format
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $logLine, $matches)) {
                $timestamp = strtotime($matches[1]);
                if ($timestamp !== false) {
                    return $timestamp;
                }
            }
        }

        return null;
    }

    /**
     * Get directory size
     */
    private function getDirectorySize(string $directory): int
    {
        $size = 0;

        if (is_dir($directory)) {
            $result = ServerManagerV1Utils::executeCommand('du', ['-sb', $directory]);

            if ($result['success']) {
                $output = trim($result['output']);
                if (preg_match('/^(\d+)/', $output, $matches)) {
                    $size = (int)$matches[1];
                }
            }
        }

        return $size;
    }
}



