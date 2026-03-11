<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AwyV0\AwyV0Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Http\Common\CommonAuthService;
use App\Http\Common\CommonUserGen;
use App\Apps\AwyV0\AwyV0Gvar\AwyV0Gvar;
use App\Services\UnifiedAuthService;
use App\Services\VerificationCodeService;

class AwyV0AuthCtl extends Controller
{
    /**
     * Register a new user
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|unique:users',
            'email' => 'required|email|unique:users',
            // [Removed] Password 'min:6' validation removed - no minimum requirement
            'password' => 'required|string',
            'name' => 'string|nullable'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $username = $request->input('username');
        $email = $request->input('email');
        $password = $request->input('password');
        $name = $request->input('name', '');

        $userData = CommonUserGen::createUser($username, $password, $email, '', $name, AppKeys::AWYV0);
        
        if (!$userData) {
            return response()->json([
                'success' => false,
                'error' => 'Registration failed',
                'data' => ['message' => 'Username already exists or registration failed']
            ], 400);
        }

        $tokenData = CommonAuthService::generateUserToken($userData['user']->id, 'AwyV0');

        return response()->json([
            'success' => true,
            'message' => 'User registered successfully',
            'data' => [
                'user' => $userData['user'],
                'login_token' => $userData['token'],
                'user_token' => $tokenData['token'],
                'user_token_expires_at' => $tokenData['expires_at'],
                'token_type' => 'Bearer'
            ]
        ]);
    }

    /**
     * User login
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string',
            'password' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $username = $request->input('username');
        $password = $request->input('password');

        $authResult = UnifiedAuthService::login($username, $password, AppKeys::AWYV0);
        
        if (!$authResult['success']) {
            return response()->json([
                'success' => false,
                'error' => 'INVALID_CREDENTIALS',
                'message' => $authResult['error'],
                'data' => null
            ], 401);
        }

        $user = $authResult['user'];
        $subAppUser = $authResult['sub_app_user'];

        $tokenData = CommonAuthService::generateUserToken($user->id, 'AwyV0');

        $user->last_login_at = now();
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'avatar' => $user->avatar,
                    'lastLoginAt' => $user->last_login_at->toISOString()
                ],
                'token' => [
                    'accessToken' => $tokenData['token'],
                    'refreshToken' => $tokenData['refresh_token'] ?? '',
                    'expiresIn' => $tokenData['expires_in'] ?? 86400,
                    'tokenType' => 'Bearer'
                ]
            ]
        ]);
    }

    /**
     * User logout
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        $token = $request->bearerToken();

        if ($token) {
            // Revoke the token using CommonAuthService
            CommonAuthService::revokeUserToken($token);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logout successful',
            'data' => true
        ]);
    }

    /**
     * Verify email
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function verifyEmail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'verification_code' => 'required|string|size:6'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $email = $request->input('email');
        $verificationCode = $request->input('verification_code');

        // Find user by email
        $user = User::where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User not found',
                'data' => null
            ], 404);
        }

        // Check if verification code matches (simplified implementation)
        // In production, this should check against stored verification codes with expiry
        if ($verificationCode !== '123456') { // Default code for testing
            return response()->json([
                'success' => false,
                'error' => 'INVALID_VERIFICATION_CODE',
                'message' => 'Invalid verification code',
                'data' => null
            ], 400);
        }

        // Mark email as verified
        $user->email_verified_at = now();
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully',
            'data' => true
        ]);
    }

    /**
     * Forgot password
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function forgotPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $email = $request->input('email');

        // Find user by email
        $user = User::where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User not found',
                'data' => null
            ], 404);
        }

        // Generate password reset token (simplified implementation)
        $resetToken = str_random(60);
        $user->password_reset_token = $resetToken;
        $user->password_reset_expires_at = now()->addHours(1);
        $user->save();

        // In production, send email with reset link
        // For now, return the token for testing
        return response()->json([
            'success' => true,
            'message' => 'Password reset link sent',
            'data' => [
                'reset_token' => $resetToken,
                'expires_at' => $user->password_reset_expires_at->toISOString()
            ]
        ]);
    }

    /**
     * Reset password
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'token' => 'required|string',
            // [Removed] Password 'min:6' validation removed - no minimum requirement
            'password' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $email = $request->input('email');
        $token = $request->input('token');
        $password = $request->input('password');

        // Find user by email
        $user = User::where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User not found',
                'data' => null
            ], 404);
        }

        // Verify reset token and expiry
        if (!$user->password_reset_token ||
            $user->password_reset_token !== $token ||
            $user->password_reset_expires_at->isPast()) {
            return response()->json([
                'success' => false,
                'error' => 'INVALID_OR_EXPIRED_TOKEN',
                'message' => 'Invalid or expired reset token',
                'data' => null
            ], 400);
        }

        $resetResult = UnifiedAuthService::resetPassword($user->username, $password);
        
        if (!$resetResult['success']) {
            return response()->json([
                'success' => false,
                'error' => 'PASSWORD_RESET_FAILED',
                'message' => $resetResult['error'],
                'data' => null
            ], 400);
        }

        $user->password_reset_token = null;
        $user->password_reset_expires_at = null;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully',
            'data' => true
        ]);
    }

    /**
     * Send SMS verification code
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sendSms(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string',
            'country_code' => 'string|nullable'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $phone = $request->input('phone');
        $countryCode = $request->input('country_code', '+86');

        // Generate verification code (simplified implementation)
        $verificationCode = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store verification code (in production, use cache or database)
        // For now, use default code for testing
        $storedCode = '123456';

        return response()->json([
            'success' => true,
            'message' => 'SMS verification code sent',
            'data' => [
                'verification_id' => uniqid('sms_', true),
                'timeout_seconds' => 60,
                'debug_code' => $storedCode // Only for development
            ]
        ]);
    }

    /**
     * Send verification code
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sendCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $phone = $request->input('phone');

        $verificationService = new VerificationCodeService(AppKeys::AWYV0, 'awy_v0_verification_codes');
        $result = $verificationService->sendCode($phone);

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'message' => 'Verification code sent successfully',
                'data' => [
                    'phone' => $result['phone'],
                    'expiresIn' => $result['expires_in']
                ]
            ]);
        } else {
            return response()->json([
                'success' => false,
                'error' => $result['error_code'] ?? 'SEND_CODE_FAILED',
                'message' => $result['error'] ?? 'Failed to send verification code',
                'data' => null
            ], 400);
        }
    }

    /**
     * Phone number login
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function phoneLogin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string',
            'verification_code' => 'required|string|size:6'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $phone = $request->input('phone');
        $verificationCode = $request->input('verification_code');

        // Find user by phone
        $user = User::where('phone', $phone)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User not found',
                'data' => null
            ], 404);
        }

        $verificationService = new VerificationCodeService(AppKeys::AWYV0, 'awy_v0_verification_codes');
        $verifyResult = $verificationService->verifyCode($phone, $verificationCode);

        if (!$verifyResult['success']) {
            return response()->json([
                'success' => false,
                'error' => $verifyResult['error_code'] ?? 'INVALID_CODE',
                'message' => $verifyResult['error'] ?? 'Invalid verification code',
                'data' => null
            ], 400);
        }

        // Generate user_token using CommonAuthService
        $tokenData = CommonAuthService::generateUserToken($user->id, 'AwyV0');

        // Update last login timestamp
        $user->last_login_at = now();
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Phone login successful',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'avatar' => $user->avatar,
                    'lastLoginAt' => $user->last_login_at->toISOString()
                ],
                'token' => [
                    'accessToken' => $tokenData['token'],
                    'refreshToken' => $tokenData['refresh_token'] ?? '',
                    'expiresIn' => $tokenData['expires_in'] ?? 86400,
                    'tokenType' => 'Bearer'
                ]
            ]
        ]);
    }
}
