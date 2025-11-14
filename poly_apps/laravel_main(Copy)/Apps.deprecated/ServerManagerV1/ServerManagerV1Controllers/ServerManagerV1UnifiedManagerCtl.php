<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ServerManagerV1UnifiedManagerCtl extends ServerManagerV1BaseCtl
{
    /**
     * List applications from unified manager
     */
    public function listApps(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'unified_list_apps');
        if ($validation) {
            return $validation;
        }
        
        try {
            $deployScript = ServerManagerV1Constants::UNIFIED_MANAGER_SCRIPTS['deploy_apps'];
            
            // Execute list command
            $result = ServerManagerV1Utils::executeCommand('bash', [$deployScript, '--list'], 30);
            
            if (!$result['success']) {
                return $this->errorResponse(
                    'Failed to retrieve application list: ' . $result['error'],
                    ServerManagerV1Constants::RESPONSE_SERVER_ERROR
                );
            }
            
            // Parse the output to extract application information
            $apps = $this->parseAppList($result['output']);
            
            // Get additional information from registry if available
            $registryPath = ServerManagerV1Constants::UNIFIED_MANAGER_SCRIPTS['app_registry'];
            $registryApps = [];
            
            if (file_exists($registryPath)) {
                $registryContent = file_get_contents($registryPath);
                $registry = json_decode($registryContent, true);
                
                if (json_last_error() === JSON_ERROR_NONE && isset($registry['apps'])) {
                    $registryApps = $registry['apps'];
                }
            }
            
            // Merge information
            foreach ($apps as &$app) {
                if (isset($registryApps[$app['name']])) {
                    $app = array_merge($app, $registryApps[$app['name']]);
                }
            }
            
            return $this->successResponse([
                'apps' => $apps,
                'total_apps' => count($apps),
                'registry_available' => !empty($registryApps),
                'deploy_script' => $deployScript
            ], 'Applications retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_list_apps');
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
            $deployScript = ServerManagerV1Constants::UNIFIED_MANAGER_SCRIPTS['deploy_apps'];
            
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
        
        $paramValidation = $this->validateParameters($request, ['app_name']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $appName = $request->input('app_name');
            
            // Check systemd service status
            $serviceStatus = $this->getServiceStatus("ncore-$appName");
            
            // Check if process is running
            $processInfo = $this->getProcessInfo($appName);
            
            // Check application port if available
            $portInfo = $this->getPortInfo($appName);
            
            // Get application directory info
            $appDir = "/www/wwwroot/core_node/apps/$appName";
            $directoryInfo = [
                'exists' => is_dir($appDir),
                'path' => $appDir,
                'size' => is_dir($appDir) ? $this->getDirectorySize($appDir) : 0
            ];
            
            return $this->successResponse([
                'app_name' => $appName,
                'service_status' => $serviceStatus,
                'process_info' => $processInfo,
                'port_info' => $portInfo,
                'directory_info' => $directoryInfo,
                'overall_status' => $this->determineOverallStatus($serviceStatus, $processInfo)
            ], 'Application status retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'unified_app_status');
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
            $appLogDir = "/www/wwwroot/core_node/apps/$appName/logs";
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
     * Parse application list output
     */
    private function parseAppList(string $output): array
    {
        $apps = [];
        $lines = explode("\n", trim($output));
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }
            
            // Try to parse different output formats
            if (preg_match('/^(\w+)\s+(.+)$/', $line, $matches)) {
                $apps[] = [
                    'name' => $matches[1],
                    'description' => $matches[2],
                    'status' => 'unknown'
                ];
            } elseif (preg_match('/^(\w+)$/', $line, $matches)) {
                $apps[] = [
                    'name' => $matches[1],
                    'description' => '',
                    'status' => 'unknown'
                ];
            }
        }
        
        return $apps;
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
