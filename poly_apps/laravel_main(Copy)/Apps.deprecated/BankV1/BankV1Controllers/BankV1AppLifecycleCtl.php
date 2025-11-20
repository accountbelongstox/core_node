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

class BankV1AppLifecycleCtl extends Controller
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

    public function appOpen(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'device_id' => 'required|string|max:255',
                'app_signature' => 'required|string|max:255',
                'timestamp' => 'required|integer',
                'event_type' => 'required|string|in:app_open',
                'app_version' => 'nullable|string|max:50',
                'platform' => 'nullable|string|in:' . implode(',', array_values(BankV1Config::PLATFORM_TYPES)),
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
            $platform = $data['platform'] ?? 'unknown';
            $appVersion = $data['app_version'] ?? 'unknown';

            // Check rate limiting
            if (!$this->securityUtils->checkRateLimit($request->ip(), 'app_open')) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('RATE_LIMIT_EXCEEDED'),
                    429,
                    BankV1Config::getErrorCode('RATE_LIMIT_EXCEEDED')
                );
            }

            // Check if device is registered and get status
            $deviceStatus = $this->securityUtils->getDeviceStatus($deviceId);
            $deviceLocked = false;
            $lockReason = null;

            if ($deviceStatus) {
                $deviceLocked = $deviceStatus['is_locked'];
                $lockReason = $deviceStatus['lock_reason'];
                
                // Update device last used timestamp
                $this->securityUtils->updateDeviceLastUsed($deviceId);
            } else {
                // Auto-register device if not exists
                $this->securityUtils->registerDevice(null, $deviceId, $appSignature, $request, [
                    'platform' => $platform,
                    'app_version' => $appVersion,
                    'auto_registered' => true,
                ]);
            }

            // Perform security check
            $securityCheck = $this->securityUtils->performSecurityCheck($deviceId, $appSignature, 'app_open');
            
            if (!$securityCheck['passed']) {
                $deviceLocked = true;
                $lockReason = $securityCheck['reason'];
                
                // Lock device
                $this->securityUtils->lockDevice($deviceId, $lockReason);
            }

            // Generate session ID
            $sessionId = uniqid('session_app_open_');

            // Log app open event
            $this->loggingUtils->logAppEvent(
                null, // No user ID for app open
                $deviceId,
                $sessionId,
                BankV1Config::LOG_EVENT_TYPES['APP_OPEN'],
                [
                    'app_signature' => $appSignature,
                    'platform' => $platform,
                    'app_version' => $appVersion,
                    'device_locked' => $deviceLocked,
                    'lock_reason' => $lockReason,
                    'security_check_passed' => $securityCheck['passed'],
                    'timestamp' => $data['timestamp'],
                ],
                $request
            );

            // Prepare server configuration
            $serverConfig = [
                'api_version' => BankV1Config::API_VERSION,
                'app_version_required' => '1.0.0',
                'maintenance_mode' => false,
                'features_enabled' => [
                    'transfers' => true,
                    'payments' => true,
                    'balance_updates' => true,
                    'registration_codes' => true,
                ],
                'rate_limits' => [
                    'per_minute' => BankV1Config::RATE_LIMIT_PER_MINUTE,
                    'per_hour' => BankV1Config::RATE_LIMIT_PER_HOUR,
                ],
                'security_settings' => [
                    'device_registration_required' => BankV1Config::DEVICE_REGISTRATION_REQUIRED,
                    'signature_validation' => BankV1Config::DEVICE_SIGNATURE_VALIDATION,
                    'session_timeout' => BankV1Config::SESSION_TIMEOUT,
                ],
            ];

            return $this->successResponse([
                'session_id' => $sessionId,
                'server_config' => $serverConfig,
                'device_locked' => $deviceLocked,
                'lock_reason' => $lockReason,
                'device_status' => $deviceStatus ? $deviceStatus['status'] : BankV1Config::DEVICE_STATUS['PENDING'],
                'timestamp' => now()->timestamp,
            ], 'App open event recorded successfully');

        } catch (\Exception $e) {
            Log::error('App open error: ' . $e->getMessage(), [
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

    public function appClose(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'device_id' => 'required|string|max:255',
                'app_signature' => 'required|string|max:255',
                'timestamp' => 'required|integer',
                'event_type' => 'required|string|in:app_close',
                'session_duration' => 'nullable|integer|min:0',
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
            $sessionDuration = $data['session_duration'] ?? 0;

            // Update device last used timestamp
            $this->securityUtils->updateDeviceLastUsed($deviceId);

            // End any active sessions for this device
            $this->endActiveSessions($deviceId);

            // Log app close event
            $this->loggingUtils->logAppEvent(
                null, // No user ID for app close
                $deviceId,
                null,
                BankV1Config::LOG_EVENT_TYPES['APP_CLOSE'],
                [
                    'app_signature' => $appSignature,
                    'session_duration' => $sessionDuration,
                    'timestamp' => $data['timestamp'],
                ],
                $request
            );

            return $this->successResponse([
                'session_ended' => true,
                'session_duration' => $sessionDuration,
                'timestamp' => now()->timestamp,
            ], 'App close event recorded successfully');

        } catch (\Exception $e) {
            Log::error('App close error: ' . $e->getMessage(), [
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

    public function heartbeat(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Validate request
            $validator = Validator::make($request->all(), [
                'timestamp' => 'required|integer',
                'session_duration' => 'nullable|integer|min:0',
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
            $deviceId = $request->header('X-Device-ID');
            $sessionDuration = $data['session_duration'] ?? 0;

            // Update session activity
            $this->updateSessionActivity($user->id, $deviceId, $sessionDuration);

            // Check if device is still valid
            $deviceStatus = $this->securityUtils->getDeviceStatus($deviceId);
            $deviceLocked = $deviceStatus ? $deviceStatus['is_locked'] : false;

            // Perform routine security check
            if (!$deviceLocked) {
                $securityCheck = $this->securityUtils->performSecurityCheck($deviceId, null, 'heartbeat');
                if (!$securityCheck['passed']) {
                    $deviceLocked = true;
                    $this->securityUtils->lockDevice($deviceId, $securityCheck['reason']);
                }
            }

            // Log heartbeat (optional, can be disabled for performance)
            if (BankV1Config::LOG_APP_LIFECYCLE) {
                $this->loggingUtils->logAppEvent(
                    $user->id,
                    $deviceId,
                    null,
                    'heartbeat',
                    [
                        'session_duration' => $sessionDuration,
                        'device_locked' => $deviceLocked,
                        'timestamp' => $data['timestamp'],
                    ],
                    $request
                );
            }

            $response = [
                'heartbeat_received' => true,
                'session_active' => true,
                'device_locked' => $deviceLocked,
                'server_time' => now()->timestamp,
            ];

            if ($deviceLocked) {
                $response['lock_reason'] = $deviceStatus['lock_reason'] ?? 'Security check failed';
            }

            return $this->successResponse($response, 'Heartbeat received');

        } catch (\Exception $e) {
            Log::error('Heartbeat error: ' . $e->getMessage());

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    private function endActiveSessions(string $deviceId): void
    {
        try {
            $sessionsTable = $this->tableMaps->getTableName('bank_sessions');
            
            DB::table($sessionsTable)
                ->where($this->tableMaps->getFieldName('bank_sessions', 'device_id'), $deviceId)
                ->where($this->tableMaps->getFieldName('bank_sessions', 'is_active'), true)
                ->update([
                    $this->tableMaps->getFieldName('bank_sessions', 'ended_at') => now(),
                    $this->tableMaps->getFieldName('bank_sessions', 'is_active') => false,
                    $this->tableMaps->getFieldName('bank_sessions', 'updated_at') => now(),
                ]);
        } catch (\Exception $e) {
            Log::error('Error ending active sessions: ' . $e->getMessage());
        }
    }

    private function updateSessionActivity(int $userId, ?string $deviceId, int $sessionDuration): void
    {
        try {
            if (!$deviceId) return;

            $sessionsTable = $this->tableMaps->getTableName('bank_sessions');
            
            DB::table($sessionsTable)
                ->where($this->tableMaps->getFieldName('bank_sessions', 'user_id'), $userId)
                ->where($this->tableMaps->getFieldName('bank_sessions', 'device_id'), $deviceId)
                ->where($this->tableMaps->getFieldName('bank_sessions', 'is_active'), true)
                ->update([
                    $this->tableMaps->getFieldName('bank_sessions', 'last_activity_at') => now(),
                    $this->tableMaps->getFieldName('bank_sessions', 'duration') => $sessionDuration,
                    $this->tableMaps->getFieldName('bank_sessions', 'updated_at') => now(),
                ]);
        } catch (\Exception $e) {
            Log::error('Error updating session activity: ' . $e->getMessage());
        }
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
