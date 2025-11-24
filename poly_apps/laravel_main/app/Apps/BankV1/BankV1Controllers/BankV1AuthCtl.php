<?php

namespace App\Apps\BankV1\BankV1Controllers;

use App\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Apps\BankV1\BankV1Gvar\BankV1Config;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;
use App\Apps\BankV1\BankV1Utils\BankV1SecurityUtils;
use App\Apps\BankV1\BankV1Utils\BankV1LoggingUtils;
use App\Services\UnifiedAuthService;
use App\Models\User;

class BankV1AuthCtl extends Controller
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

    public function login(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'username' => 'required|string|max:' . BankV1Config::USERNAME_MAX_LENGTH,
                'password' => 'required|string|min:' . BankV1Config::PASSWORD_MIN_LENGTH,
                'device_id' => 'nullable|string|max:255',
                'app_signature' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $credentials = $validator->validated();
            $deviceId = $credentials['device_id'] ?? null;
            $appSignature = $credentials['app_signature'] ?? null;

            // Check rate limiting
            if (!$this->securityUtils->checkRateLimit($request->ip(), 'login')) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('RATE_LIMIT_EXCEEDED'),
                    429,
                    BankV1Config::getErrorCode('RATE_LIMIT_EXCEEDED')
                );
            }

            $authResult = UnifiedAuthService::login($credentials['username'], $credentials['password'], 'bankv1');
            
            if (!$authResult['success']) {
                $this->loggingUtils->logSecurityEvent(
                    null,
                    $deviceId,
                    'LOGIN_FAILED',
                    'high',
                    'Login attempt failed',
                    ['username' => $credentials['username'], 'error' => $authResult['error']],
                    $request
                );

                return $this->errorResponse(
                    BankV1Config::getErrorMessage('INVALID_CREDENTIALS'),
                    401,
                    BankV1Config::getErrorCode('INVALID_CREDENTIALS')
                );
            }
            
            $user = $authResult['user'];
            $subAppUser = $authResult['sub_app_user'];
            
            if ($subAppUser && isset($subAppUser->is_locked) && $subAppUser->is_locked) {
                $this->loggingUtils->logSecurityEvent(
                    $user->id,
                    $deviceId,
                    'LOGIN_BLOCKED',
                    'high',
                    'Login attempt on locked account',
                    ['lock_reason' => $subAppUser->lock_reason ?? 'Unknown'],
                    $request
                );

                return $this->errorResponse(
                    BankV1Config::getErrorMessage('ACCOUNT_LOCKED'),
                    423,
                    BankV1Config::getErrorCode('ACCOUNT_LOCKED')
                );
            }

            // Validate device if provided
            if ($deviceId && $appSignature) {
                $deviceValidation = $this->securityUtils->validateDevice($user->id, $deviceId, $appSignature);
                if (!$deviceValidation['valid']) {
                    $this->loggingUtils->logSecurityEvent(
                        $user->id,
                        $deviceId,
                        'DEVICE_VALIDATION_FAILED',
                        'high',
                        'Device validation failed during login',
                        $deviceValidation,
                        $request
                    );

                    return $this->errorResponse(
                        $deviceValidation['message'],
                        403,
                        BankV1Config::getErrorCode('INVALID_DEVICE_SIGNATURE')
                    );
                }
            }

            // Generate JWT tokens
            $tokenData = $this->generateTokens($user, $deviceId);

            if ($subAppUser) {
                $usersTable = $this->tableMaps->getTableName('bank_users');
                DB::connection('bankv1')->table($usersTable)
                    ->where('main_user_id', $user->id)
                    ->update([
                        $this->tableMaps->getFieldName('bank_users', 'login_attempts') => 0,
                        $this->tableMaps->getFieldName('bank_users', 'last_login_at') => now(),
                    ]);
            }

            // Create session
            $sessionId = $this->createSession($user->id, $deviceId, $request);

            // Log successful login
            $this->loggingUtils->logAppEvent(
                $user->id,
                $deviceId,
                $sessionId,
                BankV1Config::LOG_EVENT_TYPES['LOGIN'],
                [
                    'username' => $user->username,
                    'device_validated' => $deviceId ? true : false,
                ],
                $request
            );

            // Get user account info
            $accountsTable = $this->tableMaps->getTableName('bank_accounts');
            $account = DB::table($accountsTable)
                ->where($this->tableMaps->getFieldName('bank_accounts', 'user_id'), $user->id)
                ->where($this->tableMaps->getFieldName('bank_accounts', 'status'), 'active')
                ->first();

            $userData = [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'full_name' => $user->full_name,
                'phone' => $user->phone,
                'balance' => $account ? (float)$account->balance : 0.0,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ];

            return $this->successResponse([
                'token' => $tokenData['access_token'],
                'refresh_token' => $tokenData['refresh_token'],
                'expires_in' => BankV1Config::JWT_TTL,
                'user' => $userData,
                'session_id' => $sessionId,
            ], BankV1Config::getSuccessMessage('LOGIN_SUCCESS'));

        } catch (\Exception $e) {
            Log::error('Login error: ' . $e->getMessage(), [
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

    public function register(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'username' => 'required|string|min:' . BankV1Config::USERNAME_MIN_LENGTH . '|max:' . BankV1Config::USERNAME_MAX_LENGTH . '|unique:' . $this->tableMaps->getTableName('bank_users') . ',' . $this->tableMaps->getFieldName('bank_users', 'username'),
                'email' => 'required|email|max:255|unique:' . $this->tableMaps->getTableName('bank_users') . ',' . $this->tableMaps->getFieldName('bank_users', 'email'),
                'password' => 'required|string|min:' . BankV1Config::PASSWORD_MIN_LENGTH . '|max:' . BankV1Config::PASSWORD_MAX_LENGTH,
                'full_name' => 'required|string|max:' . BankV1Config::FULL_NAME_MAX_LENGTH,
                'phone' => 'nullable|string|max:' . BankV1Config::PHONE_MAX_LENGTH,
                'device_id' => 'nullable|string|max:255',
                'app_signature' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $userData = $validator->validated();
            $deviceId = $userData['device_id'] ?? null;
            $appSignature = $userData['app_signature'] ?? null;

            // Check rate limiting
            if (!$this->securityUtils->checkRateLimit($request->ip(), 'register')) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('RATE_LIMIT_EXCEEDED'),
                    429,
                    BankV1Config::getErrorCode('RATE_LIMIT_EXCEEDED')
                );
            }

            DB::beginTransaction();

            try {
                $credentials = [
                    'username' => $userData['username'],
                    'email' => $userData['email'],
                    'phone' => $userData['phone'] ?? null,
                    'name' => $userData['full_name'],
                    'password' => $userData['password'],
                    'sub_app_data' => [
                        'full_name' => $userData['full_name'],
                        'account_status' => 'active',
                        'is_locked' => false,
                        'login_attempts' => 0,
                    ],
                ];
                
                $result = UnifiedAuthService::register($credentials, 'bankv1');
                
                if (!$result['success']) {
                    DB::rollBack();
                    return $this->errorResponse(
                        $result['error'],
                        422,
                        BankV1Config::getErrorCode('INVALID_CREDENTIALS')
                    );
                }
                
                $user = $result['user'];
                $subAppUser = $result['sub_app_user'];

                // Create default account
                $accountsTable = $this->tableMaps->getTableName('bank_accounts');
                $accountNumber = $this->generateAccountNumber();
                
                DB::connection('bankv1')->table($accountsTable)->insert([
                    $this->tableMaps->getFieldName('bank_accounts', 'user_id') => $subAppUser->id,
                    $this->tableMaps->getFieldName('bank_accounts', 'account_number') => $accountNumber,
                    $this->tableMaps->getFieldName('bank_accounts', 'account_type') => 'checking',
                    $this->tableMaps->getFieldName('bank_accounts', 'balance') => BankV1Config::DEFAULT_ACCOUNT_BALANCE,
                    $this->tableMaps->getFieldName('bank_accounts', 'currency') => BankV1Config::ACCOUNT_CURRENCY,
                    $this->tableMaps->getFieldName('bank_accounts', 'status') => 'active',
                    $this->tableMaps->getFieldName('bank_accounts', 'opened_at') => now(),
                    $this->tableMaps->getFieldName('bank_accounts', 'created_at') => now(),
                    $this->tableMaps->getFieldName('bank_accounts', 'updated_at') => now(),
                ]);

                // Register device if provided
                if ($deviceId && $appSignature) {
                    $this->securityUtils->registerDevice($subAppUser->id, $deviceId, $appSignature, $request);
                }

                DB::commit();

                // Log registration
                $this->loggingUtils->logAppEvent(
                    $subAppUser->id,
                    $deviceId,
                    null,
                    BankV1Config::LOG_EVENT_TYPES['LOGIN'],
                    [
                        'username' => $userData['username'],
                        'email' => $userData['email'],
                        'account_number' => $accountNumber,
                    ],
                    $request
                );

                return $this->successResponse([
                    'user_id' => $subAppUser->id,
                    'account_number' => $accountNumber,
                    'message' => BankV1Config::getSuccessMessage('REGISTRATION_SUCCESS'),
                ], BankV1Config::getSuccessMessage('REGISTRATION_SUCCESS'));

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Registration error: ' . $e->getMessage(), [
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

    public function logout(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $deviceId = $request->header('X-Device-ID');

            // Revoke current token
            $this->revokeToken($request);

            // End session
            $this->endSession($user->id, $deviceId);

            // Log logout
            $this->loggingUtils->logAppEvent(
                $user->id,
                $deviceId,
                null,
                BankV1Config::LOG_EVENT_TYPES['LOGOUT'],
                ['logout_type' => 'manual'],
                $request
            );

            return $this->successResponse(
                [],
                BankV1Config::getSuccessMessage('LOGOUT_SUCCESS')
            );

        } catch (\Exception $e) {
            Log::error('Logout error: ' . $e->getMessage());

            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    private function generateTokens($user, $deviceId = null): array
    {
        $payload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'iat' => time(),
            'exp' => time() + BankV1Config::JWT_TTL,
            'device_id' => $deviceId,
        ];

        $refreshPayload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'iat' => time(),
            'exp' => time() + BankV1Config::REFRESH_TOKEN_TTL,
            'type' => 'refresh',
            'device_id' => $deviceId,
        ];

        $accessToken = JWT::encode($payload, config('app.key'), 'HS256');
        $refreshToken = JWT::encode($refreshPayload, config('app.key'), 'HS256');

        // Store token info in database
        $tokensTable = $this->tableMaps->getTableName('bank_jwt_tokens');
        DB::table($tokensTable)->insert([
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'user_id') => $user->id,
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'device_id') => $deviceId,
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'token_id') => uniqid(),
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'token_hash') => hash('sha256', $accessToken),
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'refresh_token_hash') => hash('sha256', $refreshToken),
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'expires_at') => date('Y-m-d H:i:s', time() + BankV1Config::JWT_TTL),
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'refresh_expires_at') => date('Y-m-d H:i:s', time() + BankV1Config::REFRESH_TOKEN_TTL),
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'is_revoked') => false,
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'created_at') => now(),
            $this->tableMaps->getFieldName('bank_jwt_tokens', 'updated_at') => now(),
        ]);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
        ];
    }

    private function createSession($userId, $deviceId, Request $request): string
    {
        $sessionId = uniqid('session_');
        $sessionsTable = $this->tableMaps->getTableName('bank_sessions');

        DB::table($sessionsTable)->insert([
            $this->tableMaps->getFieldName('bank_sessions', 'session_id') => $sessionId,
            $this->tableMaps->getFieldName('bank_sessions', 'user_id') => $userId,
            $this->tableMaps->getFieldName('bank_sessions', 'device_id') => $deviceId,
            $this->tableMaps->getFieldName('bank_sessions', 'ip_address') => $request->ip(),
            $this->tableMaps->getFieldName('bank_sessions', 'user_agent') => $request->userAgent(),
            $this->tableMaps->getFieldName('bank_sessions', 'started_at') => now(),
            $this->tableMaps->getFieldName('bank_sessions', 'last_activity_at') => now(),
            $this->tableMaps->getFieldName('bank_sessions', 'is_active') => true,
            $this->tableMaps->getFieldName('bank_sessions', 'created_at') => now(),
            $this->tableMaps->getFieldName('bank_sessions', 'updated_at') => now(),
        ]);

        return $sessionId;
    }

    private function endSession($userId, $deviceId): void
    {
        $sessionsTable = $this->tableMaps->getTableName('bank_sessions');
        
        DB::table($sessionsTable)
            ->where($this->tableMaps->getFieldName('bank_sessions', 'user_id'), $userId)
            ->where($this->tableMaps->getFieldName('bank_sessions', 'device_id'), $deviceId)
            ->where($this->tableMaps->getFieldName('bank_sessions', 'is_active'), true)
            ->update([
                $this->tableMaps->getFieldName('bank_sessions', 'ended_at') => now(),
                $this->tableMaps->getFieldName('bank_sessions', 'is_active') => false,
                $this->tableMaps->getFieldName('bank_sessions', 'updated_at') => now(),
            ]);
    }

    private function revokeToken(Request $request): void
    {
        $token = $request->bearerToken();
        if ($token) {
            $tokensTable = $this->tableMaps->getTableName('bank_jwt_tokens');
            $tokenHash = hash('sha256', $token);
            
            DB::table($tokensTable)
                ->where($this->tableMaps->getFieldName('bank_jwt_tokens', 'token_hash'), $tokenHash)
                ->update([
                    $this->tableMaps->getFieldName('bank_jwt_tokens', 'is_revoked') => true,
                    $this->tableMaps->getFieldName('bank_jwt_tokens', 'revoked_at') => now(),
                    $this->tableMaps->getFieldName('bank_jwt_tokens', 'updated_at') => now(),
                ]);
        }
    }

    private function generateAccountNumber(): string
    {
        return 'ACC' . str_pad(mt_rand(1, 99999999), 8, '0', STR_PAD_LEFT);
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
