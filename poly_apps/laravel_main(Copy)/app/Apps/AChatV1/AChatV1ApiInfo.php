<?php

namespace App\Apps\AChatV1;

use Illuminate\Support\Facades\Log;
use App\Apps\AChatV1\AChatV1Gvar\AChatV1Config;

/**
 * AChatV1 API Information
 * 
 * Provides API metadata and health check for AChat application
 */
class AChatV1ApiInfo
{
    /**
     * Get API information
     */
    public static function getInfo(): array
    {
        return [
            'api_name' => 'AChatV1',
            'version' => '1.0.0',
            'description' => 'AChat Backend API - Real-time messaging and collaboration',
            'base_path' => '/achat/v1',
            'endpoints' => [
                'health' => '/achat/v1/health',
                'info' => '/achat/v1/info',
                'auth' => '/achat/v1/auth',
                'users' => '/achat/v1/users',
                'conversations' => '/achat/v1/conversations',
                'messages' => '/achat/v1/messages',
                'groups' => '/achat/v1/groups',
                'files' => '/achat/v1/files',
                'devices' => '/achat/v1/devices',
            ],
            'features' => [
                'Real-time messaging',
                'Group chats',
                'File sharing',
                'User presence',
                'Message read receipts',
                'Device management',
                'Cross-app data consistency',
            ],
            'auth_type' => 'JWT',
            'documentation' => 'https://apiv1.achat.fun/achat/v1/docs',
            'status' => 'active',
            'environment' => config('app.env'),
        ];
    }

    /**
     * Get API health status
     */
    public static function getHealthStatus(): array
    {
        try {
            $dbConnected = self::checkDatabaseConnection();
            $cacheWorking = self::checkCacheConnection();

            $status = ($dbConnected && $cacheWorking) ? 'healthy' : 'degraded';

            return [
                'success' => true,
                'status' => $status,
                'timestamp' => now()->toIso8601String(),
                'services' => [
                    'database' => [
                        'status' => $dbConnected ? 'connected' : 'disconnected',
                    ],
                    'cache' => [
                        'status' => $cacheWorking ? 'working' : 'failed',
                    ],
                    'api' => [
                        'status' => 'operational',
                    ],
                ],
                'version' => self::getInfo()['version'],
            ];
        } catch (\Exception $e) {
            Log::error('AChatV1 health check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'status' => 'unhealthy',
                'error' => 'Health check failed',
                'timestamp' => now()->toIso8601String(),
            ];
        }
    }

    /**
     * Check database connection
     */
    private static function checkDatabaseConnection(): bool
    {
        try {
            \DB::connection()->getPdo();
            return true;
        } catch (\Exception $e) {
            Log::error('Database connection check failed', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Check cache connection
     */
    private static function checkCacheConnection(): bool
    {
        try {
            \Cache::put('achat_health_check', 'ok', 10);
            $result = \Cache::get('achat_health_check') === 'ok';
            \Cache::forget('achat_health_check');
            return $result;
        } catch (\Exception $e) {
            Log::error('Cache connection check failed', ['error' => $e->getMessage()]);
            return false;
        }
    }
}

