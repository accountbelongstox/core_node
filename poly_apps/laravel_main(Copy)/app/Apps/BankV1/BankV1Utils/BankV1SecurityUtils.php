<?php

namespace App\Apps\BankV1\BankV1Utils;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Apps\BankV1\BankV1Gvar\BankV1Config;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;

class BankV1SecurityUtils
{
    private $tableMaps;
    
    public function __construct()
    {
        $this->tableMaps = new BankV1TablesMaps();
    }

    /**
     * Check rate limiting for IP address and action type
     */
    public function checkRateLimit(string $ipAddress, string $action): bool
    {
        try {
            $cacheKey = "rate_limit:{$action}:{$ipAddress}";
            $currentCount = Cache::get($cacheKey, 0);
            
            // Get rate limit based on action
            $limit = $this->getRateLimitForAction($action);
            
            if ($currentCount >= $limit) {
                return false;
            }
            
            // Increment counter with 1 minute expiry
            Cache::put($cacheKey, $currentCount + 1, 60);
            
            return true;
        } catch (\Exception $e) {
            Log::error('Rate limit check error: ' . $e->getMessage());
            return true; // Allow on error to prevent blocking legitimate users
        }
    }

    /**
     * Validate device signature and registration
     */
    public function validateDevice(?int $userId, string $deviceId, string $appSignature): array
    {
        try {
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            
            $device = DB::table($devicesTable)
                ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                ->first();

            if (!$device) {
                return [
                    'valid' => false,
                    'message' => BankV1Config::getErrorMessage('DEVICE_NOT_REGISTERED'),
                    'should_register' => true,
                ];
            }

            // Check if device is locked
            if ($device->is_locked) {
                return [
                    'valid' => false,
                    'message' => BankV1Config::getErrorMessage('DEVICE_LOCKED'),
                    'lock_reason' => $device->lock_reason,
                    'locked_at' => $device->locked_at,
                ];
            }

            // Validate app signature if signature validation is enabled
            if (BankV1Config::DEVICE_SIGNATURE_VALIDATION) {
                if ($device->app_signature !== $appSignature) {
                    return [
                        'valid' => false,
                        'message' => BankV1Config::getErrorMessage('INVALID_DEVICE_SIGNATURE'),
                        'should_lock' => true,
                    ];
                }
            }

            // Check if device belongs to user (if user is provided)
            if ($userId && $device->user_id && $device->user_id != $userId) {
                return [
                    'valid' => false,
                    'message' => 'Device is registered to another user',
                    'should_lock' => true,
                ];
            }

            // Update device user association if needed
            if ($userId && !$device->user_id) {
                DB::table($devicesTable)
                    ->where($this->tableMaps->getFieldName('bank_devices', 'id'), $device->id)
                    ->update([
                        $this->tableMaps->getFieldName('bank_devices', 'user_id') => $userId,
                        $this->tableMaps->getFieldName('bank_devices', 'status') => BankV1Config::DEVICE_STATUS['ACTIVE'],
                        $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
                    ]);
            }

            return [
                'valid' => true,
                'device_id' => $device->id,
                'status' => $device->status,
            ];

        } catch (\Exception $e) {
            Log::error('Device validation error: ' . $e->getMessage());
            return [
                'valid' => false,
                'message' => BankV1Config::getErrorMessage('INTERNAL_ERROR'),
            ];
        }
    }

    /**
     * Register a new device
     */
    public function registerDevice(?int $userId, string $deviceId, string $appSignature, Request $request, array $additionalData = []): bool
    {
        try {
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            
            $deviceData = [
                $this->tableMaps->getFieldName('bank_devices', 'user_id') => $userId,
                $this->tableMaps->getFieldName('bank_devices', 'device_id') => $deviceId,
                $this->tableMaps->getFieldName('bank_devices', 'app_signature') => $appSignature,
                $this->tableMaps->getFieldName('bank_devices', 'device_name') => $additionalData['device_name'] ?? 'Unknown Device',
                $this->tableMaps->getFieldName('bank_devices', 'platform') => $additionalData['platform'] ?? 'unknown',
                $this->tableMaps->getFieldName('bank_devices', 'app_version') => $additionalData['app_version'] ?? 'unknown',
                $this->tableMaps->getFieldName('bank_devices', 'status') => $userId ? BankV1Config::DEVICE_STATUS['ACTIVE'] : BankV1Config::DEVICE_STATUS['PENDING'],
                $this->tableMaps->getFieldName('bank_devices', 'is_locked') => false,
                $this->tableMaps->getFieldName('bank_devices', 'registered_at') => now(),
                $this->tableMaps->getFieldName('bank_devices', 'last_used_at') => now(),
                $this->tableMaps->getFieldName('bank_devices', 'created_at') => now(),
                $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
            ];

            DB::table($devicesTable)->insert($deviceData);
            
            return true;
        } catch (\Exception $e) {
            Log::error('Device registration error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get device status information
     */
    public function getDeviceStatus(string $deviceId): ?array
    {
        try {
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            
            $device = DB::table($devicesTable)
                ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                ->first();

            if (!$device) {
                return null;
            }

            return [
                'id' => $device->id,
                'user_id' => $device->user_id,
                'device_id' => $device->device_id,
                'status' => $device->status,
                'is_locked' => (bool)$device->is_locked,
                'lock_reason' => $device->lock_reason,
                'locked_at' => $device->locked_at,
                'last_used_at' => $device->last_used_at,
                'registered_at' => $device->registered_at,
            ];
        } catch (\Exception $e) {
            Log::error('Get device status error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Lock a device
     */
    public function lockDevice(string $deviceId, string $reason): bool
    {
        try {
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            
            $updated = DB::table($devicesTable)
                ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                ->update([
                    $this->tableMaps->getFieldName('bank_devices', 'is_locked') => true,
                    $this->tableMaps->getFieldName('bank_devices', 'lock_reason') => $reason,
                    $this->tableMaps->getFieldName('bank_devices', 'locked_at') => now(),
                    $this->tableMaps->getFieldName('bank_devices', 'status') => BankV1Config::DEVICE_STATUS['LOCKED'],
                    $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
                ]);

            return $updated > 0;
        } catch (\Exception $e) {
            Log::error('Lock device error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Unlock a device
     */
    public function unlockDevice(string $deviceId): bool
    {
        try {
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            
            $updated = DB::table($devicesTable)
                ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                ->update([
                    $this->tableMaps->getFieldName('bank_devices', 'is_locked') => false,
                    $this->tableMaps->getFieldName('bank_devices', 'lock_reason') => null,
                    $this->tableMaps->getFieldName('bank_devices', 'locked_at') => null,
                    $this->tableMaps->getFieldName('bank_devices', 'status') => BankV1Config::DEVICE_STATUS['ACTIVE'],
                    $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
                ]);

            return $updated > 0;
        } catch (\Exception $e) {
            Log::error('Unlock device error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Update device last used timestamp
     */
    public function updateDeviceLastUsed(string $deviceId): void
    {
        try {
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            
            DB::table($devicesTable)
                ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                ->update([
                    $this->tableMaps->getFieldName('bank_devices', 'last_used_at') => now(),
                    $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
                ]);
        } catch (\Exception $e) {
            Log::error('Update device last used error: ' . $e->getMessage());
        }
    }

    /**
     * Perform comprehensive security check
     */
    public function performSecurityCheck(string $deviceId, ?string $appSignature, string $checkType): array
    {
        try {
            $device = $this->getDeviceStatus($deviceId);
            
            if (!$device) {
                return [
                    'passed' => false,
                    'reason' => 'Device not registered',
                    'should_lock' => false,
                ];
            }

            // Check if device is already locked
            if ($device['is_locked']) {
                return [
                    'passed' => false,
                    'reason' => $device['lock_reason'] ?? 'Device is locked',
                    'should_lock' => false,
                ];
            }

            // Validate app signature if provided
            if ($appSignature && BankV1Config::DEVICE_SIGNATURE_VALIDATION) {
                $devicesTable = $this->tableMaps->getTableName('bank_devices');
                $deviceRecord = DB::table($devicesTable)
                    ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                    ->first();

                if ($deviceRecord && $deviceRecord->app_signature !== $appSignature) {
                    return [
                        'passed' => false,
                        'reason' => 'Invalid app signature',
                        'should_lock' => true,
                    ];
                }
            }

            // Check for suspicious activity patterns
            $suspiciousActivity = $this->checkSuspiciousActivity($deviceId, $checkType);
            if ($suspiciousActivity['detected']) {
                return [
                    'passed' => false,
                    'reason' => $suspiciousActivity['reason'],
                    'should_lock' => $suspiciousActivity['should_lock'],
                ];
            }

            return [
                'passed' => true,
                'reason' => 'Security check passed',
                'should_lock' => false,
            ];

        } catch (\Exception $e) {
            Log::error('Security check error: ' . $e->getMessage());
            return [
                'passed' => false,
                'reason' => 'Security check failed due to internal error',
                'should_lock' => false,
            ];
        }
    }

    /**
     * Check for suspicious activity patterns
     */
    private function checkSuspiciousActivity(string $deviceId, string $checkType): array
    {
        try {
            // Check for rapid repeated requests
            $cacheKey = "activity_check:{$deviceId}:{$checkType}";
            $recentActivity = Cache::get($cacheKey, 0);
            
            if ($recentActivity > 10) { // More than 10 requests of same type in last minute
                return [
                    'detected' => true,
                    'reason' => 'Suspicious activity: Too many rapid requests',
                    'should_lock' => true,
                ];
            }
            
            // Increment activity counter
            Cache::put($cacheKey, $recentActivity + 1, 60);

            // Check for failed login attempts from this device
            if ($checkType === 'login_security_check') {
                $securityLogsTable = $this->tableMaps->getTableName('bank_security_logs');
                $recentFailures = DB::table($securityLogsTable)
                    ->where($this->tableMaps->getFieldName('bank_security_logs', 'device_id'), $deviceId)
                    ->where($this->tableMaps->getFieldName('bank_security_logs', 'event_type'), 'LOGIN_FAILED')
                    ->where($this->tableMaps->getFieldName('bank_security_logs', 'timestamp'), '>', now()->subMinutes(15))
                    ->count();

                if ($recentFailures > 5) {
                    return [
                        'detected' => true,
                        'reason' => 'Too many failed login attempts',
                        'should_lock' => true,
                    ];
                }
            }

            return [
                'detected' => false,
                'reason' => null,
                'should_lock' => false,
            ];

        } catch (\Exception $e) {
            Log::error('Suspicious activity check error: ' . $e->getMessage());
            return [
                'detected' => false,
                'reason' => null,
                'should_lock' => false,
            ];
        }
    }

    /**
     * Get rate limit for specific action
     */
    private function getRateLimitForAction(string $action): int
    {
        $limits = [
            'login' => 10,
            'register' => 5,
            'app_open' => 20,
            'device_register' => 3,
            'security_check' => 30,
            'default' => BankV1Config::RATE_LIMIT_PER_MINUTE,
        ];

        return $limits[$action] ?? $limits['default'];
    }

    /**
     * Generate secure device signature
     */
    public function generateDeviceSignature(array $deviceInfo): string
    {
        $data = [
            'device_id' => $deviceInfo['device_id'] ?? '',
            'platform' => $deviceInfo['platform'] ?? '',
            'app_version' => $deviceInfo['app_version'] ?? '',
            'timestamp' => time(),
            'salt' => config('app.key'),
        ];

        return hash('sha256', json_encode($data));
    }

    /**
     * Verify device signature
     */
    public function verifyDeviceSignature(string $signature, array $deviceInfo): bool
    {
        $expectedSignature = $this->generateDeviceSignature($deviceInfo);
        return hash_equals($expectedSignature, $signature);
    }
}
