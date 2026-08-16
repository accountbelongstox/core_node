<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Providers\PathMapper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
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

            return $this->success([
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
            'app_name' => basename($appPath),  // For frontend compatibility
            'path' => $relativePath,  // Return relative path instead of absolute
            'app_path' => $relativePath,  // For frontend compatibility
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

            // Check nginx proxy
            $nginxStatus = $this->checkNginxProxy($app['port'], $app['name']);

            // Build status info
            $app['service_status'] = [
                'installed' => $serviceStatus['exists'],
                'service_name' => $serviceName,
                'status' => $serviceStatus['status'], // running, stopped, failed, not_installed
                'enabled' => $serviceStatus['enabled'],
                'launcher_exists' => $launcherExists,
                'launcher_path' => $launcherExists ? $launcherPath : null,
                'pid' => $serviceStatus['pid'],
                'uptime' => $serviceStatus['uptime'],
                'memory' => $serviceStatus['memory'] ?? null,
                'cpu_usage' => $serviceStatus['cpu_usage'] ?? null
            ];

            $app['nginx_proxy'] = $nginxStatus;
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
     * Check nginx reverse proxy configuration for an application
     *
     * @param int $port Application port number
     * @param string $appName Application name
     * @return array Proxy configuration status
     */
    private function checkNginxProxy(int $port, string $appName): array
    {
        $proxyStatus = [
            'configured' => false,
            'enabled' => false,
            'domains' => [],
            'config_file' => null,
            'proxy_target' => null
        ];

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled = '/etc/nginx/sites-enabled';

        // Check if nginx directories exist
        if (!is_dir($sitesAvailable)) {
            return $proxyStatus;
        }

        try {
            // Scan all nginx config files in sites-available
            $configFiles = glob($sitesAvailable . '/*');
            if (!$configFiles) {
                return $proxyStatus;
            }

            foreach ($configFiles as $configFile) {
                // Skip default and non-files
                if (!is_file($configFile) || basename($configFile) === 'default') {
                    continue;
                }

                $content = @file_get_contents($configFile);
                if ($content === false) {
                    continue;
                }

                // Check for proxy_pass with this port
                // Match: proxy_pass http://localhost:PORT or proxy_pass http://127.0.0.1:PORT
                $proxyPassPattern = '/proxy_pass\s+https?:\/\/(localhost|127\.0\.0\.1):' . $port . '/i';

                if (preg_match($proxyPassPattern, $content, $matches)) {
                    $proxyStatus['configured'] = true;
                    $proxyStatus['config_file'] = basename($configFile);
                    $proxyStatus['proxy_target'] = trim($matches[0], ';');

                    // Check if this config is enabled (symlinked in sites-enabled)
                    $enabledLink = $sitesEnabled . '/' . basename($configFile);
                    if (file_exists($enabledLink) && is_link($enabledLink)) {
                        $proxyStatus['enabled'] = true;
                    }

                    // Extract domain names from server_name directives
                    if (preg_match_all('/server_name\s+([^;]+);/i', $content, $domainMatches)) {
                        foreach ($domainMatches[1] as $domainLine) {
                            $domains = preg_split('/\s+/', trim($domainLine));
                            foreach ($domains as $domain) {
                                $domain = trim($domain);
                                // Skip wildcards and default_server
                                if (!empty($domain) && $domain !== '_' && $domain !== 'default_server') {
                                    $proxyStatus['domains'][] = $domain;
                                }
                            }
                        }
                    }

                    // Remove duplicates
                    $proxyStatus['domains'] = array_unique($proxyStatus['domains']);

                    // Found matching proxy config, no need to check other files
                    break;
                }
            }
        } catch (\Exception $e) {
            Log::warning('ServerManagerV1: Failed to check nginx proxy', [
                'app_name' => $appName,
                'port' => $port,
                'error' => $e->getMessage()
            ]);
        }

        return $proxyStatus;
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
                return $this->error("Service not installed: {$serviceName}", 404);
            }

            // Start service
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['start', $serviceName], 10);

            if (!$result['success']) {
                return $this->error("Failed to start service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            // Get updated status
            $status = $this->checkSystemdService($serviceName);

            return $this->success([
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
                return $this->error("Failed to stop service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            // Get updated status
            $status = $this->checkSystemdService($serviceName);

            return $this->success([
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
                return $this->error("Service not installed: {$serviceName}", 404);
            }

            // Restart service
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 10);

            if (!$result['success']) {
                return $this->error("Failed to restart service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            // Get updated status
            $status = $this->checkSystemdService($serviceName);

            return $this->success([
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
                    return $this->error(
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
            
            return $this->success($deploymentResult, $message);
            
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

            return $this->success([
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
            $serviceName = 'app-manager-laravel_main';

            // Clear Laravel caches before restart
            Artisan::call('config:clear');
            Artisan::call('route:clear');
            Artisan::call('cache:clear');

            // Register shutdown function to restart after response is sent
            register_shutdown_function(function() use ($serviceName) {
                // Give the response time to be sent
                sleep(1);

                // Restart Octane service
                $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 15);

                // Log the result
                if (!$result['success']) {
                    Log::error('[ServerManager] Failed to restart Octane service', [
                        'service' => $serviceName,
                        'error' => $result['error'] ?? 'Unknown error',
                        'exit_code' => $result['exit_code'] ?? null
                    ]);
                } else {
                    Log::info('[ServerManager] Octane service restarted successfully', [
                        'service' => $serviceName,
                        'output' => $result['output'] ?? ''
                    ]);
                }
            });

            // Return success response immediately
            return $this->success([
                'service_name' => $serviceName,
                'message' => 'Server will restart in 1 second',
                'caches_cleared' => ['config', 'route', 'cache']
            ], 'Restart command scheduled successfully');

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
            $serviceName = 'app-manager-laravel_main';

            // Reload Octane service (graceful)
            $result = ServerManagerV1Utils::executeCommand('systemctl', ['reload', $serviceName], 10);

            if (!$result['success']) {
                return $this->error("Failed to reload Octane: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            return $this->success([
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
            
            return $this->success([
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
     * Get service status information via systemctl (Linux only)
     */
    private function getServiceStatusViaSystemctl(string $serviceName): array
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

    /**
     * List all systemd services
     */
    public function listServices(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_list_services');
        if ($validation) {
            return $validation;
        }

        try {
            $keyword = $request->input('keyword');
            $state = $request->input('state');
            $limit = $request->input('limit', 100);
            $offset = $request->input('offset', 0);

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend'], 30);

            if (!$result['success']) {
                return $this->error('Failed to list services', 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            $services = $this->parseSystemctlOutput($result['output']);

            if ($keyword) {
                $services = array_filter($services, function($service) use ($keyword) {
                    return stripos($service['name'], $keyword) !== false ||
                           stripos($service['description'], $keyword) !== false;
                });
                $services = array_values($services);
            }

            if ($state) {
                $services = array_filter($services, function($service) use ($state) {
                    return stripos($service['state'], $state) !== false ||
                           stripos($service['sub_state'], $state) !== false;
                });
                $services = array_values($services);
            }

            $totalServices = count($services);
            $services = array_slice($services, $offset, $limit);

            return $this->success([
                'services' => $services,
                'total' => $totalServices,
                'limit' => $limit,
                'offset' => $offset,
                'filtered' => !empty($keyword) || !empty($state)
            ], 'Services retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_list_services');
        }
    }

    /**
     * Search services by keyword
     */
    public function searchServices(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_search_services');
        if ($validation) {
            return $validation;
        }

        try {
            $keyword = $request->input('keyword');

            if (empty($keyword)) {
                return $this->error('Keyword parameter is required', 400);
            }

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend'], 30);

            if (!$result['success']) {
                return $this->error('Failed to search services', 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            $services = $this->parseSystemctlOutput($result['output']);

            $matched = array_filter($services, function($service) use ($keyword) {
                return stripos($service['name'], $keyword) !== false ||
                       stripos($service['description'], $keyword) !== false;
            });

            $matched = array_values($matched);

            return $this->success([
                'services' => $matched,
                'keyword' => $keyword,
                'total_matched' => count($matched)
            ], 'Search completed successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_search_services');
        }
    }

    /**
     * Get service status
     */
    public function getServiceStatus(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_service_status');
        if ($validation) {
            return $validation;
        }

        try {
            $serviceName = $request->input('service_name');

            if (empty($serviceName)) {
                return $this->error('service_name parameter is required', 400);
            }

            $detailedStatus = $this->getDetailedServiceStatus($serviceName);

            $statusResult = ServerManagerV1Utils::executeCommand('systemctl', ['status', $serviceName, '--no-pager'], 10);

            return $this->success([
                'service_name' => $serviceName,
                'exists' => $detailedStatus['exists'],
                'running' => $detailedStatus['running'],
                'active' => $detailedStatus['active'],
                'enabled' => $detailedStatus['enabled'],
                'state' => $detailedStatus['state'],
                'status_output' => $statusResult['output'],
                'status_code' => $statusResult['exit_code']
            ], 'Service status retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_service_status');
        }
    }

    /**
     * Restart a single service
     */
    public function restartService(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_restart_service');
        if ($validation) {
            return $validation;
        }

        try {
            $serviceName = $request->input('service_name');
            $async = $request->input('async', false);

            if (empty($serviceName)) {
                return $this->error('service_name parameter is required', 400);
            }

            if (!$this->isServiceNameValid($serviceName)) {
                return $this->error('Invalid service name format', 400);
            }

            $beforeStatus = $this->getDetailedServiceStatus($serviceName);

            if (!$beforeStatus['exists']) {
                return $this->error('Service does not exist: ' . $serviceName, 404, [
                    'service_name' => $serviceName,
                    'exists' => false
                ]);
            }

            if ($async) {
                register_shutdown_function(function() use ($serviceName) {
                    sleep(1);
                    $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 30);

                    if (!$result['success']) {
                        Log::error('[ServerManager] Failed to restart service', [
                            'service' => $serviceName,
                            'error' => $result['error'] ?? 'Unknown error'
                        ]);
                    } else {
                        Log::info('[ServerManager] Service restarted successfully', [
                            'service' => $serviceName
                        ]);
                    }
                });

                return $this->success([
                    'service_name' => $serviceName,
                    'before_restart' => $beforeStatus,
                    'message' => 'Service will restart in 1 second',
                    'async' => true
                ], 'Restart command scheduled successfully');
            }

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 30);

            if (!$result['success']) {
                return $this->error("Failed to restart service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code'],
                    'output' => $result['output'],
                    'before_restart' => $beforeStatus
                ]);
            }

            sleep(1);
            $afterStatus = $this->getDetailedServiceStatus($serviceName);

            return $this->success([
                'service_name' => $serviceName,
                'before_restart' => $beforeStatus,
                'after_restart' => $afterStatus,
                'restarted' => true,
                'output' => $result['output'],
                'async' => false
            ], 'Service restarted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_restart_service');
        }
    }

    /**
     * Restart multiple services by keyword
     */
    public function restartServicesByKeyword(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_restart_services_by_keyword');
        if ($validation) {
            return $validation;
        }

        try {
            $keyword = $request->input('keyword');
            $dryRun = $request->input('dry_run', false);
            $async = $request->input('async', false);

            if (empty($keyword)) {
                return $this->error('keyword parameter is required', 400);
            }

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend'], 30);

            if (!$result['success']) {
                return $this->error('Failed to list services', 500, [
                    'error' => $result['error']
                ]);
            }

            $services = $this->parseSystemctlOutput($result['output']);
            $matched = array_filter($services, function($service) use ($keyword) {
                return stripos($service['name'], $keyword) !== false ||
                       stripos($service['description'], $keyword) !== false;
            });

            $matched = array_values($matched);

            if (empty($matched)) {
                return $this->success([
                    'keyword' => $keyword,
                    'matched_services' => [],
                    'total_matched' => 0,
                    'restarted' => []
                ], 'No services matched the keyword');
            }

            if ($dryRun) {
                return $this->success([
                    'keyword' => $keyword,
                    'matched_services' => $matched,
                    'total_matched' => count($matched),
                    'dry_run' => true,
                    'message' => 'This is a dry run, no services were restarted'
                ], 'Dry run completed');
            }

            $restarted = [];
            $failed = [];

            if ($async) {
                register_shutdown_function(function() use ($matched) {
                    sleep(1);
                    foreach ($matched as $service) {
                        $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $service['name']], 30);

                        if (!$result['success']) {
                            Log::error('[ServerManager] Failed to restart service in batch', [
                                'service' => $service['name'],
                                'error' => $result['error'] ?? 'Unknown error'
                            ]);
                        } else {
                            Log::info('[ServerManager] Service restarted in batch', [
                                'service' => $service['name']
                            ]);
                        }
                    }
                });

                return $this->success([
                    'keyword' => $keyword,
                    'matched_services' => $matched,
                    'total_matched' => count($matched),
                    'message' => 'All matched services will restart in 1 second',
                    'async' => true
                ], 'Batch restart scheduled successfully');
            }

            foreach ($matched as $service) {
                $restartResult = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $service['name']], 30);

                if ($restartResult['success']) {
                    $restarted[] = [
                        'service_name' => $service['name'],
                        'status' => 'restarted'
                    ];
                } else {
                    $failed[] = [
                        'service_name' => $service['name'],
                        'error' => $restartResult['error'],
                        'exit_code' => $restartResult['exit_code']
                    ];
                }
            }

            return $this->success([
                'keyword' => $keyword,
                'total_matched' => count($matched),
                'restarted' => $restarted,
                'failed' => $failed,
                'success_count' => count($restarted),
                'failed_count' => count($failed)
            ], 'Batch restart completed');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_restart_services_by_keyword');
        }
    }

    /**
     * Start a service
     */
    public function startService(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_start_service');
        if ($validation) {
            return $validation;
        }

        try {
            $serviceName = $request->input('service_name');

            if (empty($serviceName)) {
                return $this->error('service_name parameter is required', 400);
            }

            if (!$this->isServiceNameValid($serviceName)) {
                return $this->error('Invalid service name format', 400);
            }

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['start', $serviceName], 30);

            if (!$result['success']) {
                return $this->error("Failed to start service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            return $this->success([
                'service_name' => $serviceName,
                'output' => $result['output']
            ], 'Service started successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_start_service');
        }
    }

    /**
     * Stop a service
     */
    public function stopService(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_stop_service');
        if ($validation) {
            return $validation;
        }

        try {
            $serviceName = $request->input('service_name');

            if (empty($serviceName)) {
                return $this->error('service_name parameter is required', 400);
            }

            if (!$this->isServiceNameValid($serviceName)) {
                return $this->error('Invalid service name format', 400);
            }

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['stop', $serviceName], 30);

            if (!$result['success']) {
                return $this->error("Failed to stop service: {$serviceName}", 500, [
                    'error' => $result['error'],
                    'exit_code' => $result['exit_code']
                ]);
            }

            return $this->success([
                'service_name' => $serviceName,
                'output' => $result['output']
            ], 'Service stopped successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_stop_service');
        }
    }

    /**
     * Parse systemctl list-units output
     */
    private function parseSystemctlOutput(string $output): array
    {
        $services = [];
        $lines = explode("\n", trim($output));

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) {
                continue;
            }

            $parts = preg_split('/\s+/', $line, 5);

            if (count($parts) >= 4) {
                $services[] = [
                    'name' => $parts[0],
                    'load' => $parts[1] ?? '',
                    'state' => $parts[2] ?? '',
                    'sub_state' => $parts[3] ?? '',
                    'description' => $parts[4] ?? ''
                ];
            }
        }

        return $services;
    }

    /**
     * Restart service by poly_apps application name
     */
    public function restartServiceByAppName(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'system_restart_service_by_appname');
        if ($validation) {
            return $validation;
        }

        try {
            $appName = $request->input('app_name');
            $async = $request->input('async', false);

            if (empty($appName)) {
                return $this->error('app_name parameter is required', 400);
            }

            $appName = trim($appName, '/');
            $appName = str_replace('poly_apps/', '', $appName);

            $result = ServerManagerV1Utils::executeCommand('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend'], 30);

            if (!$result['success']) {
                return $this->error('Failed to list services', 500, [
                    'error' => $result['error']
                ]);
            }

            $services = $this->parseSystemctlOutput($result['output']);
            $matched = array_filter($services, function($service) use ($appName) {
                return stripos($service['name'], $appName) !== false ||
                       stripos($service['description'], $appName) !== false;
            });

            $matched = array_values($matched);

            if (empty($matched)) {
                return $this->error('No service found for application: ' . $appName, 404, [
                    'app_name' => $appName,
                    'searched_patterns' => [$appName]
                ]);
            }

            if (count($matched) > 1) {
                return $this->success([
                    'app_name' => $appName,
                    'matched_services' => $matched,
                    'total_matched' => count($matched),
                    'message' => 'Multiple services found. Please specify which one to restart or use restart-by-keyword endpoint.'
                ], 'Multiple services matched');
            }

            $targetService = $matched[0];
            $serviceName = $targetService['name'];

            $beforeStatus = $this->getDetailedServiceStatus($serviceName);

            if (!$beforeStatus['exists']) {
                return $this->error('Service does not exist: ' . $serviceName, 404);
            }

            if ($async) {
                register_shutdown_function(function() use ($serviceName, $appName) {
                    sleep(1);
                    $result = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 30);

                    if (!$result['success']) {
                        Log::error('[ServerManager] Failed to restart service by appname', [
                            'app_name' => $appName,
                            'service' => $serviceName,
                            'error' => $result['error'] ?? 'Unknown error'
                        ]);
                    } else {
                        Log::info('[ServerManager] Service restarted by appname', [
                            'app_name' => $appName,
                            'service' => $serviceName
                        ]);
                    }
                });

                return $this->success([
                    'app_name' => $appName,
                    'service_name' => $serviceName,
                    'before_restart' => $beforeStatus,
                    'message' => 'Service will restart in 1 second',
                    'async' => true
                ], 'Restart scheduled successfully');
            }

            $restartResult = ServerManagerV1Utils::executeCommand('systemctl', ['restart', $serviceName], 30);

            if (!$restartResult['success']) {
                return $this->error("Failed to restart service: {$serviceName}", 500, [
                    'error' => $restartResult['error'],
                    'exit_code' => $restartResult['exit_code'],
                    'before_restart' => $beforeStatus
                ]);
            }

            sleep(1);
            $afterStatus = $this->getDetailedServiceStatus($serviceName);

            return $this->success([
                'app_name' => $appName,
                'service_name' => $serviceName,
                'before_restart' => $beforeStatus,
                'after_restart' => $afterStatus,
                'restarted' => true,
                'async' => false
            ], 'Service restarted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'system_restart_service_by_appname');
        }
    }

    /**
     * Get detailed service status including existence, running state, etc.
     */
    private function getDetailedServiceStatus(string $serviceName): array
    {
        $statusResult = ServerManagerV1Utils::executeCommand('systemctl', ['status', $serviceName, '--no-pager'], 10);
        $isActiveResult = ServerManagerV1Utils::executeCommand('systemctl', ['is-active', $serviceName], 5);
        $isEnabledResult = ServerManagerV1Utils::executeCommand('systemctl', ['is-enabled', $serviceName], 5);

        $exists = $statusResult['exit_code'] !== 4;
        $active = trim($isActiveResult['output']) === 'active';
        $enabled = trim($isEnabledResult['output']) === 'enabled';
        $state = trim($isActiveResult['output']);

        return [
            'exists' => $exists,
            'running' => $active,
            'active' => $active,
            'enabled' => $enabled,
            'state' => $state,
            'exit_code' => $statusResult['exit_code']
        ];
    }

    /**
     * Validate service name format
     */
    private function isServiceNameValid(string $serviceName): bool
    {
        return preg_match('/^[a-zA-Z0-9_\-\.@]+\.service$|^[a-zA-Z0-9_\-\.@]+$/', $serviceName) === 1;
    }
}



