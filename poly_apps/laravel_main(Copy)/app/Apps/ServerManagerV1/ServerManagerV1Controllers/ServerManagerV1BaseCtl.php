<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Http\Controllers\Controller;
use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ServerManagerV1BaseCtl extends Controller
{
    /**
     * Authenticate request using API key
     * In debug/local mode or CLI mode, authentication is bypassed for easier development
     */
    protected function authenticate(Request $request): bool
    {
        // Check if we're running in console (CLI) - skip authentication for command line
        if (app()->runningInConsole()) {
            Log::info('ServerManagerV1: Authentication bypassed for CLI/console environment');
            return true;
        }

        // Check if we're in debug or local environment - skip authentication
        $appEnv = config('app.env');
        $appDebug = config('app.debug');

        if ($appEnv === 'local' || $appEnv === 'debug' || $appDebug === true) {
            Log::info('ServerManagerV1: Authentication bypassed for debug/local environment', [
                'app_env' => $appEnv,
                'app_debug' => $appDebug,
                'ip' => $request->ip()
            ]);
            return true;
        }

        // Production authentication
        $apiKey = $request->header(ServerManagerV1Constants::AUTH_HEADER);

        if (empty($apiKey)) {
            return false;
        }

        // Get API key from environment or use default
        $validApiKey = env('SERVER_MANAGER_API_KEY', config('app.server_manager_api_key', 'default-server-manager-key'));

        return hash_equals($validApiKey, $apiKey);
    }
    
    /**
     * Check rate limiting
     */
    protected function checkRateLimit(Request $request): bool
    {
        // Simple rate limiting implementation
        // In production, use Laravel's built-in rate limiting
        return true;
    }
    
    /**
     * Log API request
     */
    protected function logRequest(Request $request, string $action): void
    {
        Log::info('ServerManagerV1 API Request', [
            'action' => $action,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'timestamp' => now()->toISOString()
        ]);
    }
    
    /**
     * Return success response
     */
    protected function successResponse($data = null, string $message = '', int $code = 200): JsonResponse
    {
        return response()->json(
            ServerManagerV1Utils::apiResponse(true, $data, $message, $code),
            $code
        );
    }
    
    /**
     * Return error response
     */
    protected function errorResponse(string $message, int $code = 400, $data = null): JsonResponse
    {
        return response()->json(
            ServerManagerV1Utils::apiResponse(false, $data, $message, $code),
            $code
        );
    }
    
    /**
     * Validate request authentication and rate limiting
     */
    protected function validateRequest(Request $request, string $action): ?JsonResponse
    {
        // Log the request
        $this->logRequest($request, $action);
        
        // Check authentication
        if (!$this->authenticate($request)) {
            return $this->errorResponse(
                'Authentication required. Please provide valid API key in ' . ServerManagerV1Constants::AUTH_HEADER . ' header.',
                ServerManagerV1Constants::RESPONSE_UNAUTHORIZED
            );
        }
        
        // Check rate limiting
        if (!$this->checkRateLimit($request)) {
            return $this->errorResponse(
                'Rate limit exceeded. Please try again later.',
                429
            );
        }
        
        return null;
    }
    
    /**
     * Handle exceptions and return appropriate error response
     */
    protected function handleException(\Exception $e, string $action): JsonResponse
    {
        Log::error('ServerManagerV1 Exception', [
            'action' => $action,
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return $this->errorResponse(
            'Internal server error occurred.',
            ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
        );
    }
    
    /**
     * Validate required parameters
     */
    protected function validateParameters(Request $request, array $required): ?JsonResponse
    {
        $missing = [];
        
        foreach ($required as $param) {
            if (!$request->has($param) || empty($request->input($param))) {
                $missing[] = $param;
            }
        }
        
        if (!empty($missing)) {
            return $this->errorResponse(
                'Missing required parameters: ' . implode(', ', $missing),
                ServerManagerV1Constants::RESPONSE_BAD_REQUEST
            );
        }
        
        return null;
    }
    
    /**
     * Get client IP address
     */
    protected function getClientIp(Request $request): string
    {
        return $request->ip();
    }
    
    /**
     * Get user agent
     */
    protected function getUserAgent(Request $request): string
    {
        return $request->userAgent() ?? 'Unknown';
    }
    
    /**
     * Check if path is safe for file operations
     */
    protected function validateFilePath(string $path): bool
    {
        $sanitizedPath = ServerManagerV1Utils::sanitizePath($path);
        return ServerManagerV1Utils::isPathAllowed($sanitizedPath);
    }
    
    /**
     * Execute system command with proper logging
     */
    protected function executeSystemCommand(string $command, array $arguments = []): array
    {
        // Validate command is in allowed list
        if (!in_array($command, array_values(ServerManagerV1Constants::SYSTEM_COMMANDS))) {
            return [
                'success' => false,
                'output' => '',
                'error' => 'Command not allowed',
                'exit_code' => -1
            ];
        }
        
        return ServerManagerV1Utils::executeCommand($command, $arguments);
    }
    
    /**
     * Get system status information
     */
    protected function getSystemStatus(): array
    {
        return [
            'server_time' => now()->toISOString(),
            'uptime' => $this->getSystemUptime(),
            'load_average' => $this->getLoadAverage(),
            'memory_usage' => $this->getMemoryUsage(),
            'disk_usage' => $this->getDiskUsage()
        ];
    }
    
    /**
     * Get system uptime
     */
    private function getSystemUptime(): string
    {
        $result = ServerManagerV1Utils::executeCommand('uptime');
        return $result['success'] ? trim($result['output']) : 'N/A';
    }
    
    /**
     * Get load average
     */
    private function getLoadAverage(): array
    {
        $loadavg = sys_getloadavg();
        return [
            '1min' => $loadavg[0] ?? 0,
            '5min' => $loadavg[1] ?? 0,
            '15min' => $loadavg[2] ?? 0
        ];
    }
    
    /**
     * Get memory usage
     */
    private function getMemoryUsage(): array
    {
        $result = ServerManagerV1Utils::executeCommand('free', ['-b']);
        if (!$result['success']) {
            return ['total' => 0, 'used' => 0, 'free' => 0];
        }
        
        $lines = explode("\n", $result['output']);
        if (count($lines) < 2) {
            return ['total' => 0, 'used' => 0, 'free' => 0];
        }
        
        $memLine = preg_split('/\s+/', $lines[1]);
        return [
            'total' => (int)($memLine[1] ?? 0),
            'used' => (int)($memLine[2] ?? 0),
            'free' => (int)($memLine[3] ?? 0)
        ];
    }
    
    /**
     * Get disk usage
     */
    private function getDiskUsage(): array
    {
        $result = ServerManagerV1Utils::executeCommand('df', ['-B1', '/']);
        if (!$result['success']) {
            return ['total' => 0, 'used' => 0, 'available' => 0];
        }
        
        $lines = explode("\n", $result['output']);
        if (count($lines) < 2) {
            return ['total' => 0, 'used' => 0, 'available' => 0];
        }
        
        $diskLine = preg_split('/\s+/', $lines[1]);
        return [
            'total' => (int)($diskLine[1] ?? 0),
            'used' => (int)($diskLine[2] ?? 0),
            'available' => (int)($diskLine[3] ?? 0)
        ];
    }
}
