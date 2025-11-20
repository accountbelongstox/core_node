<?php

namespace App\Apps\BankV1\BankV1Utils;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Apps\BankV1\BankV1Gvar\BankV1Config;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;

class BankV1LoggingUtils
{
    private $tableMaps;
    
    public function __construct()
    {
        $this->tableMaps = new BankV1TablesMaps();
    }

    /**
     * Log application events (app lifecycle, user actions, etc.)
     */
    public function logAppEvent(?int $userId, ?string $deviceId, ?string $sessionId, string $eventType, array $eventData, Request $request): bool
    {
        try {
            if (!BankV1Config::LOG_APP_LIFECYCLE && in_array($eventType, ['app_open', 'app_close', 'heartbeat'])) {
                return true; // Skip logging if disabled
            }

            if (!BankV1Config::LOG_USER_ACTIONS && !in_array($eventType, ['app_open', 'app_close', 'heartbeat'])) {
                return true; // Skip logging if disabled
            }

            $appLogsTable = $this->tableMaps->getTableName('bank_app_logs');
            
            $logData = [
                $this->tableMaps->getFieldName('bank_app_logs', 'user_id') => $userId,
                $this->tableMaps->getFieldName('bank_app_logs', 'device_id') => $deviceId,
                $this->tableMaps->getFieldName('bank_app_logs', 'session_id') => $sessionId,
                $this->tableMaps->getFieldName('bank_app_logs', 'event_type') => $eventType,
                $this->tableMaps->getFieldName('bank_app_logs', 'event_data') => json_encode($eventData),
                $this->tableMaps->getFieldName('bank_app_logs', 'ip_address') => $request->ip(),
                $this->tableMaps->getFieldName('bank_app_logs', 'user_agent') => $request->userAgent(),
                $this->tableMaps->getFieldName('bank_app_logs', 'timestamp') => now(),
                $this->tableMaps->getFieldName('bank_app_logs', 'created_at') => now(),
            ];

            DB::table($appLogsTable)->insert($logData);
            
            return true;
        } catch (\Exception $e) {
            Log::error('App event logging error: ' . $e->getMessage(), [
                'event_type' => $eventType,
                'user_id' => $userId,
                'device_id' => $deviceId,
            ]);
            return false;
        }
    }

    /**
     * Log security events (authentication, device validation, suspicious activity)
     */
    public function logSecurityEvent(?int $userId, ?string $deviceId, string $eventType, string $severity, string $description, array $eventData, Request $request): bool
    {
        try {
            if (!BankV1Config::LOG_SECURITY_EVENTS) {
                return true; // Skip logging if disabled
            }

            $securityLogsTable = $this->tableMaps->getTableName('bank_security_logs');
            
            $logData = [
                $this->tableMaps->getFieldName('bank_security_logs', 'user_id') => $userId,
                $this->tableMaps->getFieldName('bank_security_logs', 'device_id') => $deviceId,
                $this->tableMaps->getFieldName('bank_security_logs', 'event_type') => $eventType,
                $this->tableMaps->getFieldName('bank_security_logs', 'severity') => $severity,
                $this->tableMaps->getFieldName('bank_security_logs', 'description') => $description,
                $this->tableMaps->getFieldName('bank_security_logs', 'event_data') => json_encode($eventData),
                $this->tableMaps->getFieldName('bank_security_logs', 'ip_address') => $request->ip(),
                $this->tableMaps->getFieldName('bank_security_logs', 'user_agent') => $request->userAgent(),
                $this->tableMaps->getFieldName('bank_security_logs', 'resolved') => false,
                $this->tableMaps->getFieldName('bank_security_logs', 'timestamp') => now(),
                $this->tableMaps->getFieldName('bank_security_logs', 'created_at') => now(),
            ];

            DB::table($securityLogsTable)->insert($logData);
            
            // Also log to Laravel's default log for high severity events
            if (in_array($severity, ['high', 'critical'])) {
                Log::warning("Security Event: {$eventType}", [
                    'description' => $description,
                    'user_id' => $userId,
                    'device_id' => $deviceId,
                    'ip_address' => $request->ip(),
                    'event_data' => $eventData,
                ]);
            }
            
            return true;
        } catch (\Exception $e) {
            Log::error('Security event logging error: ' . $e->getMessage(), [
                'event_type' => $eventType,
                'user_id' => $userId,
                'device_id' => $deviceId,
            ]);
            return false;
        }
    }

    /**
     * Log API requests and responses
     */
    public function logApiRequest(Request $request, ?array $response, int $statusCode, float $executionTime): bool
    {
        try {
            if (!BankV1Config::LOG_API_REQUESTS) {
                return true; // Skip logging if disabled
            }

            // Use Laravel's default log for API requests
            $logData = [
                'method' => $request->method(),
                'url' => $request->fullUrl(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'request_headers' => $this->sanitizeHeaders($request->headers->all()),
                'request_body' => $this->sanitizeRequestBody($request->all()),
                'response_status' => $statusCode,
                'response_body' => $response ? $this->sanitizeResponseBody($response) : null,
                'execution_time' => $executionTime,
                'timestamp' => now()->toISOString(),
            ];

            Log::info('API Request', $logData);
            
            return true;
        } catch (\Exception $e) {
            Log::error('API request logging error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get recent app events for a user or device
     */
    public function getRecentAppEvents(?int $userId = null, ?string $deviceId = null, int $limit = 50): array
    {
        try {
            $appLogsTable = $this->tableMaps->getTableName('bank_app_logs');
            
            $query = DB::table($appLogsTable);
            
            if ($userId) {
                $query->where($this->tableMaps->getFieldName('bank_app_logs', 'user_id'), $userId);
            }
            
            if ($deviceId) {
                $query->where($this->tableMaps->getFieldName('bank_app_logs', 'device_id'), $deviceId);
            }
            
            $events = $query
                ->orderBy($this->tableMaps->getFieldName('bank_app_logs', 'timestamp'), 'desc')
                ->limit($limit)
                ->get()
                ->toArray();

            return array_map(function($event) {
                return [
                    'id' => $event->id,
                    'user_id' => $event->user_id,
                    'device_id' => $event->device_id,
                    'session_id' => $event->session_id,
                    'event_type' => $event->event_type,
                    'event_data' => json_decode($event->event_data, true),
                    'ip_address' => $event->ip_address,
                    'timestamp' => $event->timestamp,
                ];
            }, $events);

        } catch (\Exception $e) {
            Log::error('Get recent app events error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get recent security events
     */
    public function getRecentSecurityEvents(?int $userId = null, ?string $deviceId = null, ?string $severity = null, int $limit = 50): array
    {
        try {
            $securityLogsTable = $this->tableMaps->getTableName('bank_security_logs');
            
            $query = DB::table($securityLogsTable);
            
            if ($userId) {
                $query->where($this->tableMaps->getFieldName('bank_security_logs', 'user_id'), $userId);
            }
            
            if ($deviceId) {
                $query->where($this->tableMaps->getFieldName('bank_security_logs', 'device_id'), $deviceId);
            }
            
            if ($severity) {
                $query->where($this->tableMaps->getFieldName('bank_security_logs', 'severity'), $severity);
            }
            
            $events = $query
                ->orderBy($this->tableMaps->getFieldName('bank_security_logs', 'timestamp'), 'desc')
                ->limit($limit)
                ->get()
                ->toArray();

            return array_map(function($event) {
                return [
                    'id' => $event->id,
                    'user_id' => $event->user_id,
                    'device_id' => $event->device_id,
                    'event_type' => $event->event_type,
                    'severity' => $event->severity,
                    'description' => $event->description,
                    'event_data' => json_decode($event->event_data, true),
                    'ip_address' => $event->ip_address,
                    'resolved' => (bool)$event->resolved,
                    'timestamp' => $event->timestamp,
                ];
            }, $events);

        } catch (\Exception $e) {
            Log::error('Get recent security events error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Clean up old logs based on retention policy
     */
    public function cleanupOldLogs(): bool
    {
        try {
            $retentionDate = now()->subDays(BankV1Config::LOG_RETENTION_DAYS);
            
            // Clean up app logs
            $appLogsTable = $this->tableMaps->getTableName('bank_app_logs');
            $deletedAppLogs = DB::table($appLogsTable)
                ->where($this->tableMaps->getFieldName('bank_app_logs', 'created_at'), '<', $retentionDate)
                ->delete();

            // Clean up security logs (keep resolved ones longer)
            $securityLogsTable = $this->tableMaps->getTableName('bank_security_logs');
            $deletedSecurityLogs = DB::table($securityLogsTable)
                ->where($this->tableMaps->getFieldName('bank_security_logs', 'created_at'), '<', $retentionDate)
                ->where($this->tableMaps->getFieldName('bank_security_logs', 'resolved'), true)
                ->delete();

            Log::info('Log cleanup completed', [
                'deleted_app_logs' => $deletedAppLogs,
                'deleted_security_logs' => $deletedSecurityLogs,
                'retention_days' => BankV1Config::LOG_RETENTION_DAYS,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Log cleanup error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Sanitize request headers for logging
     */
    private function sanitizeHeaders(array $headers): array
    {
        $sensitiveHeaders = ['authorization', 'x-api-key', 'x-auth-token'];
        
        foreach ($sensitiveHeaders as $header) {
            if (isset($headers[$header])) {
                $headers[$header] = ['***REDACTED***'];
            }
        }
        
        return $headers;
    }

    /**
     * Sanitize request body for logging
     */
    private function sanitizeRequestBody(array $body): array
    {
        $sensitiveFields = ['password', 'password_confirmation', 'token', 'secret', 'api_key'];
        
        foreach ($sensitiveFields as $field) {
            if (isset($body[$field])) {
                $body[$field] = '***REDACTED***';
            }
        }
        
        return $body;
    }

    /**
     * Sanitize response body for logging
     */
    private function sanitizeResponseBody(array $response): array
    {
        $sensitiveFields = ['token', 'refresh_token', 'password', 'secret', 'api_key'];
        
        foreach ($sensitiveFields as $field) {
            if (isset($response[$field])) {
                $response[$field] = '***REDACTED***';
            }
            
            // Also check nested data
            if (isset($response['data']) && is_array($response['data'])) {
                foreach ($sensitiveFields as $nestedField) {
                    if (isset($response['data'][$nestedField])) {
                        $response['data'][$nestedField] = '***REDACTED***';
                    }
                }
            }
        }
        
        return $response;
    }

    /**
     * Mark security event as resolved
     */
    public function resolveSecurityEvent(int $eventId, ?int $resolvedBy = null): bool
    {
        try {
            $securityLogsTable = $this->tableMaps->getTableName('bank_security_logs');
            
            $updated = DB::table($securityLogsTable)
                ->where($this->tableMaps->getFieldName('bank_security_logs', 'id'), $eventId)
                ->update([
                    $this->tableMaps->getFieldName('bank_security_logs', 'resolved') => true,
                    $this->tableMaps->getFieldName('bank_security_logs', 'resolved_at') => now(),
                    $this->tableMaps->getFieldName('bank_security_logs', 'resolved_by') => $resolvedBy,
                ]);

            return $updated > 0;
        } catch (\Exception $e) {
            Log::error('Resolve security event error: ' . $e->getMessage());
            return false;
        }
    }
}
