<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ServerManagerV1CodeExecutorCtl extends ServerManagerV1BaseCtl
{
    /**
     * Hardcoded predefined scripts for security
     */
    private function getPredefinedScripts(): array
    {
        return [
            1 => [
                'id' => 1,
                'name' => 'System Information',
                'category' => 'diagnostic',
                'description' => 'Get comprehensive system information',
                'command' => 'uname -a && uptime && free -h && df -h',
                'timeout' => 30,
                'requires_sudo' => false
            ],
            2 => [
                'id' => 2,
                'name' => 'Process List',
                'category' => 'diagnostic',
                'description' => 'List running processes',
                'command' => 'ps aux --sort=-%cpu | head -20',
                'timeout' => 15,
                'requires_sudo' => false
            ],
            3 => [
                'id' => 3,
                'name' => 'Disk Usage Analysis',
                'category' => 'diagnostic',
                'description' => 'Analyze disk usage by directory',
                // Use PathMapper for environment-aware path (no hardcoded paths)
                'command' => 'du -h --max-depth=2 ' . \App\Providers\PathMapper::mapWebPath('wwwroot') . ' | sort -hr | head -20',
                'timeout' => 60,
                'requires_sudo' => false
            ],
            4 => [
                'id' => 4,
                'name' => 'Network Status',
                'category' => 'diagnostic',
                'description' => 'Check network interfaces and connections',
                'command' => 'ip addr show && ss -tuln',
                'timeout' => 30,
                'requires_sudo' => false
            ],
            5 => [
                'id' => 5,
                'name' => 'Service Status Check',
                'category' => 'diagnostic',
                'description' => 'Check status of important services',
                'command' => 'systemctl status nginx php8.2-fpm mysql redis --no-pager -l',
                'timeout' => 30,
                'requires_sudo' => false
            ],
            6 => [
                'id' => 6,
                'name' => 'Log Rotation',
                'category' => 'system_maintenance',
                'description' => 'Rotate system logs',
                'command' => 'logrotate -f /etc/logrotate.conf',
                'timeout' => 120,
                'requires_sudo' => true
            ],
            7 => [
                'id' => 7,
                'name' => 'Clear System Cache',
                'category' => 'system_maintenance',
                'description' => 'Clear system caches and temporary files',
                'command' => 'sync && echo 3 > /proc/sys/vm/drop_caches',
                'timeout' => 30,
                'requires_sudo' => true
            ],
            8 => [
                'id' => 8,
                'name' => 'Nginx Configuration Test',
                'category' => 'diagnostic',
                'description' => 'Test nginx configuration',
                'command' => 'nginx -t',
                'timeout' => 15,
                'requires_sudo' => false
            ],
            9 => [
                'id' => 9,
                'name' => 'PHP Configuration Check',
                'category' => 'diagnostic',
                'description' => 'Check PHP configuration and modules',
                'command' => 'php -v && php -m | head -20',
                'timeout' => 15,
                'requires_sudo' => false
            ],
            10 => [
                'id' => 10,
                'name' => 'Unified Manager - List Apps',
                'category' => 'unified_manager',
                'description' => 'List applications from unified manager',
                // Use PathMapper for environment-aware path (no hardcoded paths)
                'command' => 'bash ' . \App\Providers\PathMapper::mapWebPath('wwwroot') . '/core_node/scripts/unified_manager/deploy_apps.sh --list',
                'timeout' => 30,
                'requires_sudo' => false
            ],
            11 => [
                'id' => 11,
                'name' => 'Restart Laravel Octane Server',
                'category' => 'system_maintenance',
                'description' => 'Restart the app-manager-laravel_main Octane service to reload code changes',
                'command' => 'systemctl restart app-manager-laravel_main',
                'timeout' => 30,
                'requires_sudo' => false
            ]
        ];
    }
    
    /**
     * List available predefined scripts
     */
    public function listScripts(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'executor_list_scripts');
        if ($validation) {
            return $validation;
        }
        
        try {
            $scripts = $this->getPredefinedScripts();
            $category = $request->input('category');
            
            // Filter by category if specified
            if ($category) {
                $scripts = array_filter($scripts, function($script) use ($category) {
                    return $script['category'] === $category;
                });
            }
            
            return $this->success([
                'scripts' => array_values($scripts),
                'total_scripts' => count($scripts),
                'categories' => ServerManagerV1Constants::SCRIPT_CATEGORIES,
                'security_note' => 'Only predefined hardcoded scripts can be executed'
            ], 'Available scripts retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'executor_list_scripts');
        }
    }
    
    /**
     * Execute predefined script by ID
     */
    public function executeScript(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'executor_run_script');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['script_id']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $scriptId = (int)$request->input('script_id');
            $scripts = $this->getPredefinedScripts();
            
            if (!isset($scripts[$scriptId])) {
                return $this->error(
                    'Script not found. Use /executor/scripts to list available scripts.',
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            $script = $scripts[$scriptId];
            
            // Security check: no sudo scripts for now
            if ($script['requires_sudo']) {
                return $this->error(
                    'Scripts requiring sudo are not allowed in this environment.',
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            $startTime = microtime(true);
            $executionId = uniqid('exec_', true);
            
            // Log execution start
            Log::info('ServerManagerV1: Script execution started', [
                'execution_id' => $executionId,
                'script_id' => $scriptId,
                'script_name' => $script['name'],
                'command' => $script['command'],
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            
            // Execute the command
            $result = ServerManagerV1Utils::executeCommand(
                $script['command'],
                [],
                $script['timeout']
            );
            
            $endTime = microtime(true);
            $executionTime = $endTime - $startTime;
            
            // Prepare execution result
            $executionResult = [
                'execution_id' => $executionId,
                'script_id' => $scriptId,
                'script_name' => $script['name'],
                'script_category' => $script['category'],
                'command' => $script['command'],
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
            
            // Log execution completion
            Log::info('ServerManagerV1: Script execution completed', [
                'execution_id' => $executionId,
                'success' => $result['success'],
                'exit_code' => $result['exit_code'],
                'execution_time' => $executionTime
            ]);
            
            $message = $result['success'] 
                ? 'Script executed successfully' 
                : 'Script execution failed';
            
            return $this->success($executionResult, $message);
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'executor_run_script');
        }
    }
    
    /**
     * Get execution logs (simplified version without database)
     */
    public function getLogs(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'executor_get_logs');
        if ($validation) {
            return $validation;
        }
        
        try {
            // Since we don't have database access, return recent log entries from Laravel logs
            $logFile = storage_path('logs/laravel.log');
            $logs = [];
            
            if (file_exists($logFile)) {
                $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $lines = array_reverse($lines); // Most recent first
                
                $executionLogs = [];
                $count = 0;
                $limit = (int)$request->input('limit', 50);
                
                foreach ($lines as $line) {
                    if (strpos($line, 'ServerManagerV1: Script execution') !== false && $count < $limit) {
                        $executionLogs[] = [
                            'timestamp' => $this->extractTimestamp($line),
                            'message' => $line,
                            'type' => strpos($line, 'started') !== false ? 'started' : 'completed'
                        ];
                        $count++;
                    }
                }
                
                $logs = $executionLogs;
            }
            
            return $this->success([
                'logs' => $logs,
                'total_logs' => count($logs),
                'log_source' => 'Laravel application logs',
                'note' => 'Database logging not available due to SQLite driver issues'
            ], 'Execution logs retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'executor_get_logs');
        }
    }
    
    /**
     * Get execution status (simplified version)
     */
    public function getStatus(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'executor_get_status');
        if ($validation) {
            return $validation;
        }
        
        try {
            $executionId = $request->input('execution_id');
            
            if (!$executionId) {
                return $this->error(
                    'execution_id parameter is required',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Since we don't have database, we'll check recent logs
            $logFile = storage_path('logs/laravel.log');
            $status = [
                'execution_id' => $executionId,
                'status' => 'unknown',
                'found' => false
            ];
            
            if (file_exists($logFile)) {
                $content = file_get_contents($logFile);
                if (strpos($content, $executionId) !== false) {
                    $status['found'] = true;
                    if (strpos($content, $executionId . '.*completed') !== false) {
                        $status['status'] = 'completed';
                    } elseif (strpos($content, $executionId . '.*started') !== false) {
                        $status['status'] = 'running';
                    }
                }
            }
            
            return $this->success($status, 'Execution status retrieved');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'executor_get_status');
        }
    }
    
    /**
     * Extract timestamp from log line
     */
    private function extractTimestamp(string $line): string
    {
        if (preg_match('/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/', $line, $matches)) {
            return $matches[1];
        }
        return date('Y-m-d H:i:s');
    }
}
