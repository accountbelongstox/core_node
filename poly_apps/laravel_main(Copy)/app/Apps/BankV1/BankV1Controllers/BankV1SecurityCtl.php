<?php

namespace App\Apps\BankV1\BankV1Controllers;

use App\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Apps\BankV1\BankV1Gvar\BankV1Config;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;
use App\Apps\BankV1\BankV1Utils\BankV1SecurityUtils;
use App\Apps\BankV1\BankV1Utils\BankV1LoggingUtils;

class BankV1SecurityCtl extends Controller
{
    private $tableMaps;
    private $securityUtils;
    private $loggingUtils;
    
    public function __construct()
    {
        $this->tableMaps = new BankV1TablesMaps();
        $this->securityUtils = new BankV1SecurityUtils();
        $this->loggingUtils = new BankV1LoggingUtils();
    }

    public function registerDevice(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'device_id' => 'required|string|max:255',
                'app_signature' => 'required|string|max:255',
                'registration_timestamp' => 'required|integer',
                'device_name' => 'nullable|string|max:100',
                'platform' => 'nullable|string|in:' . implode(',', array_values(BankV1Config::PLATFORM_TYPES)),
                'app_version' => 'nullable|string|max:50',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $data = $validator->validated();
            $deviceId = $data['device_id'];
            $appSignature = $data['app_signature'];
            $deviceName = $data['device_name'] ?? 'Unknown Device';
            $platform = $data['platform'] ?? 'unknown';
            $appVersion = $data['app_version'] ?? 'unknown';

            // Check rate limiting
            if (!$this->securityUtils->checkRateLimit($request->ip(), 'device_register')) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('RATE_LIMIT_EXCEEDED'),
                    429,
                    BankV1Config::getErrorCode('RATE_LIMIT_EXCEEDED')
                );
            }

            // Check if device already exists
            $devicesTable = $this->tableMaps->getTableName('bank_devices');
            $existingDevice = DB::table($devicesTable)
                ->where($this->tableMaps->getFieldName('bank_devices', 'device_id'), $deviceId)
                ->first();

            if ($existingDevice) {
                // Update existing device
                DB::table($devicesTable)
                    ->where($this->tableMaps->getFieldName('bank_devices', 'id'), $existingDevice->id)
                    ->update([
                        $this->tableMaps->getFieldName('bank_devices', 'app_signature') => $appSignature,
                        $this->tableMaps->getFieldName('bank_devices', 'device_name') => $deviceName,
                        $this->tableMaps->getFieldName('bank_devices', 'platform') => $platform,
                        $this->tableMaps->getFieldName('bank_devices', 'app_version') => $appVersion,
                        $this->tableMaps->getFieldName('bank_devices', 'last_used_at') => now(),
                        $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
                    ]);

                $deviceStatus = $existingDevice->status;
                $deviceRegistered = true;
            } else {
                // Register new device
                DB::table($devicesTable)->insert([
                    $this->tableMaps->getFieldName('bank_devices', 'user_id') => null, // Will be set when user logs in
                    $this->tableMaps->getFieldName('bank_devices', 'device_id') => $deviceId,
                    $this->tableMaps->getFieldName('bank_devices', 'app_signature') => $appSignature,
                    $this->tableMaps->getFieldName('bank_devices', 'device_name') => $deviceName,
                    $this->tableMaps->getFieldName('bank_devices', 'platform') => $platform,
                    $this->tableMaps->getFieldName('bank_devices', 'app_version') => $appVersion,
                    $this->tableMaps->getFieldName('bank_devices', 'status') => BankV1Config::DEVICE_STATUS['PENDING'],
                    $this->tableMaps->getFieldName('bank_devices', 'is_locked') => false,
                    $this->tableMaps->getFieldName('bank_devices', 'registered_at') => now(),
                    $this->tableMaps->getFieldName('bank_devices', 'last_used_at') => now(),
                    $this->tableMaps->getFieldName('bank_devices', 'created_at') => now(),
                    $this->tableMaps->getFieldName('bank_devices', 'updated_at') => now(),
                ]);

                $deviceStatus = BankV1Config::DEVICE_STATUS['PENDING'];
                $deviceRegistered = true;
            }

            // Log device registration
            $this->loggingUtils->logSecurityEvent(
                null,
                $deviceId,
                BankV1Config::LOG_EVENT_TYPES['DEVICE_REGISTER'],
                'low',
                'Device registration attempt',
                [
                    'device_name' => $deviceName,
                    'platform' => $platform,
                    'app_version' => $appVersion,
                    'registration_type' => $existingDevice ? 'update' : 'new',
                ],
                $request
            );

            return $this->successResponse([
                'device_registered' => $deviceRegistered,
                'device_status' => $deviceStatus,
                'registration_timestamp' => now()->timestamp,
            ], BankV1Config::getSuccessMessage('DEVICE_REGISTERED'));

        } catch (\Exception $e) {
            Log::error('Device registration error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function getDeviceStatus(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->query(), [
                'device_id' => 'required|string|max:255',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $deviceId = $request->query('device_id');

            // Get device status
            $deviceStatus = $this->securityUtils->getDeviceStatus($deviceId);

            if (!$deviceStatus) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('DEVICE_NOT_REGISTERED'),
                    404,
                    BankV1Config::getErrorCode('DEVICE_NOT_REGISTERED')
                );
            }

            return $this->successResponse([
                'device_locked' => $deviceStatus['is_locked'],
                'lock_reason' => $deviceStatus['lock_reason'],
                'device_status' => $deviceStatus['status'],
                'last_used_at' => $deviceStatus['last_used_at'],
                'registered_at' => $deviceStatus['registered_at'],
            ]);

        } catch (\Exception $e) {
            Log::error('Get device status error: ' . $e->getMessage());

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function performSecurityCheck(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'device_id' => 'required|string|max:255',
                'app_signature' => 'required|string|max:255',
                'timestamp' => 'required|integer',
                'check_type' => 'required|string|in:' . implode(',', array_values(BankV1Config::SECURITY_CHECK_TYPES)),
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $data = $validator->validated();
            $deviceId = $data['device_id'];
            $appSignature = $data['app_signature'];
            $checkType = $data['check_type'];

            // Perform security check
            $securityCheck = $this->securityUtils->performSecurityCheck($deviceId, $appSignature, $checkType);

            $response = [
                'security_status' => $securityCheck['passed'] ? 'passed' : 'failed',
                'check_type' => $checkType,
                'timestamp' => now()->timestamp,
            ];

            // If security check failed, handle device lock
            if (!$securityCheck['passed']) {
                $lockReason = $securityCheck['reason'];
                
                // Lock device if required
                if ($securityCheck['should_lock']) {
                    $this->securityUtils->lockDevice($deviceId, $lockReason);
                    $response['device_lock'] = true;
                    $response['lock_reason'] = $lockReason;
                }

                // Log security event
                $this->loggingUtils->logSecurityEvent(
                    null,
                    $deviceId,
                    'SECURITY_CHECK_FAILED',
                    'high',
                    'Security check failed: ' . $lockReason,
                    [
                        'check_type' => $checkType,
                        'failure_reason' => $lockReason,
                        'device_locked' => $securityCheck['should_lock'],
                    ],
                    $request
                );

                return $this->errorResponse(
                    $lockReason,
                    403,
                    BankV1Config::getErrorCode('INVALID_DEVICE_SIGNATURE'),
                    $response
                );
            }

            // Log successful security check
            $this->loggingUtils->logSecurityEvent(
                null,
                $deviceId,
                'SECURITY_CHECK_PASSED',
                'low',
                'Security check passed',
                [
                    'check_type' => $checkType,
                ],
                $request
            );

            return $this->successResponse($response, 'Security check passed');

        } catch (\Exception $e) {
            Log::error('Security check error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function lockDevice(Request $request): JsonResponse
    {
        try {
            // This endpoint is for administrative use only
            // In production, this should be protected with admin authentication
            
            $validator = Validator::make($request->all(), [
                'device_id' => 'required|string|max:255',
                'lock_reason' => 'required|string|max:255',
                'admin_token' => 'required|string', // Admin authentication token
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $data = $validator->validated();
            $deviceId = $data['device_id'];
            $lockReason = $data['lock_reason'];
            $adminToken = $data['admin_token'];

            // Verify admin token (implement your admin authentication logic here)
            if (!$this->verifyAdminToken($adminToken)) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('UNAUTHORIZED_ACCESS'),
                    401,
                    BankV1Config::getErrorCode('UNAUTHORIZED_ACCESS')
                );
            }

            // Lock the device
            $lockResult = $this->securityUtils->lockDevice($deviceId, $lockReason);

            if (!$lockResult) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('DEVICE_NOT_FOUND'),
                    404,
                    BankV1Config::getErrorCode('DEVICE_NOT_FOUND')
                );
            }

            // Log admin device lock
            $this->loggingUtils->logSecurityEvent(
                null,
                $deviceId,
                BankV1Config::LOG_EVENT_TYPES['DEVICE_LOCK'],
                'high',
                'Device locked by administrator',
                [
                    'lock_reason' => $lockReason,
                    'locked_by' => 'admin',
                    'admin_action' => true,
                ],
                $request
            );

            return $this->successResponse([
                'device_locked' => true,
                'lock_reason' => $lockReason,
                'locked_at' => now()->toISOString(),
            ], 'Device locked successfully');

        } catch (\Exception $e) {
            Log::error('Lock device error: ' . $e->getMessage());

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function unlockDevice(Request $request): JsonResponse
    {
        try {
            // This endpoint is for administrative use only
            
            $validator = Validator::make($request->all(), [
                'device_id' => 'required|string|max:255',
                'unlock_reason' => 'required|string|max:255',
                'admin_token' => 'required|string',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $data = $validator->validated();
            $deviceId = $data['device_id'];
            $unlockReason = $data['unlock_reason'];
            $adminToken = $data['admin_token'];

            // Verify admin token
            if (!$this->verifyAdminToken($adminToken)) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('UNAUTHORIZED_ACCESS'),
                    401,
                    BankV1Config::getErrorCode('UNAUTHORIZED_ACCESS')
                );
            }

            // Unlock the device
            $unlockResult = $this->securityUtils->unlockDevice($deviceId);

            if (!$unlockResult) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('DEVICE_NOT_FOUND'),
                    404,
                    BankV1Config::getErrorCode('DEVICE_NOT_FOUND')
                );
            }

            // Log admin device unlock
            $this->loggingUtils->logSecurityEvent(
                null,
                $deviceId,
                'DEVICE_UNLOCK',
                'medium',
                'Device unlocked by administrator',
                [
                    'unlock_reason' => $unlockReason,
                    'unlocked_by' => 'admin',
                    'admin_action' => true,
                ],
                $request
            );

            return $this->successResponse([
                'device_unlocked' => true,
                'unlock_reason' => $unlockReason,
                'unlocked_at' => now()->toISOString(),
            ], 'Device unlocked successfully');

        } catch (\Exception $e) {
            Log::error('Unlock device error: ' . $e->getMessage());

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    private function verifyAdminToken(string $token): bool
    {
        // Implement your admin token verification logic here
        // This is a placeholder implementation
        $validAdminTokens = [
            'admin_token_123456789',
            'super_admin_token_987654321',
        ];
        
        return in_array($token, $validAdminTokens);
    }

    private function successResponse(array $data, string $message = 'Success'): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ]);
    }

    private function errorResponse(string $message, int $statusCode = 400, string $errorCode = null, array $errors = []): JsonResponse
    {
        $response = [
            'success' => false,
            'error' => $message,
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ];

        if ($errorCode) {
            $response['error_code'] = $errorCode;
        }

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $statusCode);
    }
}
