<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use Illuminate\Support\Facades\Log;

class ServerManagerV1Utils
{
    /**
     * Validate if a file path is allowed for access
     */
    public static function isPathAllowed(string $path): bool
    {
        $realPath = realpath($path);
        if ($realPath === false) {
            return false;
        }
        
        foreach (ServerManagerV1Constants::getAllowedDownloadPaths() as $allowedPath) {
            if (strpos($realPath, $allowedPath) === 0) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Sanitize file path to prevent directory traversal
     */
    public static function sanitizePath(string $path): string
    {
        // Remove any directory traversal attempts
        $path = str_replace(['../', '..\\', '../', '..\\'], '', $path);
        
        // Remove null bytes
        $path = str_replace("\0", '', $path);
        
        // Normalize path separators
        $path = str_replace('\\', '/', $path);
        
        return $path;
    }
    
    /**
     * Resolve a browse path against the allowed whitelist. Falls back to the
     * first existing allowed directory when the requested path does not exist
     * (e.g. legacy /www/wwwroot/... aliases on hosts that use PathMapper roots).
     */
    public static function resolveBrowsePath(?string $requestedPath): array
    {
        $allowedPaths = ServerManagerV1Constants::getAllowedDownloadPaths();
        $defaultPath = self::firstExistingAllowedPath($allowedPaths);

        if ($requestedPath === null || trim($requestedPath) === '') {
            return [
                'path' => $defaultPath,
                'fallback' => true,
                'requested' => null,
            ];
        }

        $sanitized = self::sanitizePath($requestedPath);
        $real = realpath($sanitized);
        if ($real !== false && is_dir($real) && self::isPathAllowed($real)) {
            return [
                'path' => $real,
                'fallback' => false,
                'requested' => $sanitized,
            ];
        }

        $requestedTail2 = self::pathTail($sanitized, 2);
        $requestedTail3 = self::pathTail($sanitized, 3);

        foreach ($allowedPaths as $allowed) {
            if (!is_string($allowed) || $allowed === '') {
                continue;
            }

            $realAllowed = realpath($allowed);
            if ($realAllowed === false || !is_dir($realAllowed)) {
                continue;
            }

            $allowedTail2 = self::pathTail($allowed, 2);
            $allowedTail3 = self::pathTail($allowed, 3);

            if (
                ($requestedTail2 && $allowedTail2 && $requestedTail2 === $allowedTail2)
                || ($requestedTail3 && $allowedTail3 && $requestedTail3 === $allowedTail3)
            ) {
                return [
                    'path' => $realAllowed,
                    'fallback' => true,
                    'requested' => $sanitized,
                ];
            }
        }

        return [
            'path' => $defaultPath,
            'fallback' => true,
            'requested' => $sanitized,
        ];
    }

    /**
     * Preview/write access is allowed for all file types within whitelisted paths.
     * Path whitelist and size limits remain the security boundary.
     */
    public static function isPreviewAllowed(string $filename): bool
    {
        return true;
    }

    /**
     * Write access is allowed for all file types within whitelisted paths.
     */
    public static function isWriteAllowed(string $filename): bool
    {
        return true;
    }

    /**
     * Detect binary content (null bytes or invalid UTF-8).
     */
    public static function isBinaryContent(string $content): bool
    {
        if ($content === '') {
            return false;
        }

        if (str_contains($content, "\0")) {
            return true;
        }

        return !mb_check_encoding($content, 'UTF-8');
    }

    /**
     * Write file content directly when the web user has write permission.
     */
    public static function writeFileDirect(string $filePath, string $content): array
    {
        $written = @file_put_contents($filePath, $content, LOCK_EX);
        if ($written === false) {
            return [
                'success' => false,
                'error' => 'Failed to write file.',
                'code' => 500,
                'needs_elevation' => !is_writable(dirname($filePath)),
            ];
        }

        clearstatcache(true, $filePath);
        return ['success' => true];
    }

    private static function firstExistingAllowedPath(array $allowedPaths): ?string
    {
        foreach ($allowedPaths as $allowedPath) {
            if (!is_string($allowedPath) || $allowedPath === '') {
                continue;
            }

            $real = realpath($allowedPath);
            if ($real !== false && is_dir($real)) {
                return $real;
            }
        }

        return null;
    }

    private static function pathTail(string $path, int $segments): ?string
    {
        $parts = array_values(array_filter(explode('/', str_replace('\\', '/', $path))));
        if (count($parts) === 0) {
            return null;
        }

        $segments = min($segments, count($parts));
        return implode('/', array_slice($parts, -$segments));
    }

    /**
     * Execute system command safely with logging
     *
     * @param array|null $env Extra environment variables merged on top of the
     *                        current process environment (null = inherit as-is)
     */
    public static function executeCommand(string $command, array $arguments = [], ?int $timeout = null, ?array $env = null): array
    {
        $timeout = $timeout ?? ServerManagerV1Constants::MAX_EXECUTION_TIME;
        
        // Log command execution attempt
        Log::debug('ServerManagerV1: Executing command', [
            'command' => $command,
            'arguments' => $arguments,
            'timeout' => $timeout
        ]);
        
        $startTime = microtime(true);
        $startMemory = memory_get_usage();
        
        // Build full command
        $fullCommand = $command;
        if (!empty($arguments)) {
            $fullCommand .= ' ' . implode(' ', array_map('escapeshellarg', $arguments));
        }
        
        // Execute command with timeout
        $descriptorSpec = [
            0 => ['pipe', 'r'],  // stdin
            1 => ['pipe', 'w'],  // stdout
            2 => ['pipe', 'w']   // stderr
        ];
        
        $envVars = $env !== null ? array_merge(getenv(), $env) : null;

        $process = proc_open($fullCommand, $descriptorSpec, $pipes, null, $envVars);
        
        if (!is_resource($process)) {
            return [
                'success' => false,
                'output' => '',
                'error' => 'Failed to start process',
                'exit_code' => -1,
                'execution_time' => 0,
                'memory_usage' => 0
            ];
        }
        
        // Close stdin
        fclose($pipes[0]);
        
        // Set non-blocking mode for stdout and stderr
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        
        $output = '';
        $error = '';
        $timeoutReached = false;
        
        while (true) {
            $status = proc_get_status($process);
            
            if (!$status['running']) {
                break;
            }
            
            // Check timeout
            if ((microtime(true) - $startTime) > $timeout) {
                $timeoutReached = true;
                proc_terminate($process);
                break;
            }
            
            // Read output
            $output .= stream_get_contents($pipes[1]);
            $error .= stream_get_contents($pipes[2]);
            
            usleep(100000); // 0.1 second
        }
        
        // Read any remaining output
        $output .= stream_get_contents($pipes[1]);
        $error .= stream_get_contents($pipes[2]);
        
        fclose($pipes[1]);
        fclose($pipes[2]);
        
        $exitCode = proc_close($process);
        $executionTime = microtime(true) - $startTime;
        $memoryUsage = memory_get_usage() - $startMemory;
        
        $result = [
            'success' => !$timeoutReached && $exitCode === 0,
            'output' => $output,
            'error' => $error,
            'exit_code' => $exitCode,
            'execution_time' => $executionTime,
            'memory_usage' => $memoryUsage,
            'timeout_reached' => $timeoutReached
        ];
        
        // Log execution result (failures stay visible, successes are debug-level)
        if ($result['success']) {
            Log::debug('ServerManagerV1: Command execution completed', [
                'command' => $command,
                'success' => $result['success'],
                'exit_code' => $exitCode,
                'execution_time' => $executionTime,
                'memory_usage' => $memoryUsage
            ]);
        } else {
            Log::warning('ServerManagerV1: Command execution failed', [
                'command' => $command,
                'exit_code' => $exitCode,
                'timeout_reached' => $timeoutReached,
                'error' => mb_substr($error, 0, 500)
            ]);
        }
        
        return $result;
    }
    
    /**
     * Get system information
     */
    public static function getSystemInfo(): array
    {
        $info = [];
        
        // Basic system info
        $info['hostname'] = gethostname();
        $info['php_version'] = PHP_VERSION;
        $info['laravel_version'] = app()->version();
        
        // System commands
        $commands = [
            'uname' => 'uname -a',
            'uptime' => 'uptime',
            'disk_usage' => 'df -h',
            'memory_info' => 'free -h',
            'cpu_info' => 'cat /proc/cpuinfo | grep "model name" | head -1'
        ];
        
        foreach ($commands as $key => $command) {
            $result = self::executeCommand($command);
            $info[$key] = $result['success'] ? trim($result['output']) : 'N/A';
        }
        
        return $info;
    }
    
    /**
     * Format file size in human readable format
     */
    public static function formatFileSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= (1 << (10 * $pow));
        
        return round($bytes, 2) . ' ' . $units[$pow];
    }
    
    /**
     * Generate API response
     */
    public static function apiResponse(bool $success, $data = null, string $message = '', int $code = 200): array
    {
        return [
            'success' => $success,
            'data' => $data,
            'message' => $message,
            'timestamp' => now()->toISOString(),
            'code' => $code
        ];
    }
    
    /**
     * Log file access attempt
     */
    public static function logFileAccess(string $action, string $filePath, bool $success, string $error = ''): void
    {
        Log::info('ServerManagerV1: File access', [
            'action' => $action,
            'file_path' => $filePath,
            'success' => $success,
            'error' => $error,
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent()
        ]);
    }
    
    /**
     * Check if service is running
     */
    public static function isServiceRunning(string $serviceName): bool
    {
        $result = self::executeCommand('systemctl', ['is-active', $serviceName]);
        return $result['success'] && trim($result['output']) === 'active';
    }
    
    /**
     * Get directory listing with security checks
     */
    public static function getDirectoryListing(string $path): array
    {
        if (!self::isPathAllowed($path)) {
            return [];
        }
        
        if (!is_dir($path)) {
            return [];
        }
        
        $items = [];
        $files = scandir($path);
        
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            
            $fullPath = $path . '/' . $file;
            $isDir = is_dir($fullPath);
            
            $items[] = [
                'name' => $file,
                'path' => $fullPath,
                'is_directory' => $isDir,
                'size' => $isDir ? 0 : filesize($fullPath),
                'modified' => filemtime($fullPath),
                'permissions' => substr(sprintf('%o', fileperms($fullPath)), -4),
                'readable' => is_readable($fullPath),
                'writable' => is_writable($fullPath)
            ];
        }
        
        return $items;
    }
}
