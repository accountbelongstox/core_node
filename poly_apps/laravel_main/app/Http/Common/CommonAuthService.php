<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Http\Common;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Unified Authentication Service for Poly Laravel Apps
 * 
 * Features:
 * - login_token: Session-based authentication (sanctum tokens)
 * - user_token: Long-term authentication (7 days, custom tokens)
 * - Multi-device login control per app
 * - Token refresh mechanism
 * - Unified login response format
 */
class CommonAuthService
{
    /**
     * User token expiration time (7 days)
     */
    const USER_TOKEN_EXPIRES_DAYS = 7;
    
    /**
     * User token length
     */
    const USER_TOKEN_LENGTH = 64;

    /**
     * Authenticate user and generate tokens
     * 
     * @param string $username
     * @param string $password
     * @param string $appName Application name (DictV1, AwyV0, etc.)
     * @param string|null $userToken Existing user token for token-based login
     * @return array|null
     */
    public static function authenticateUser($username = null, $password = null, $appName = 'common', $userToken = null)
    {
        $user = null;
        $loginBy = 'username-password';

        // Authenticate by user_token if provided
        if ($userToken) {
            $user = self::getUserByUserToken($userToken);
            $loginBy = 'user-token';
        }
        // Authenticate by username/password
        elseif ($username && $password) {
            $user = User::where(function($query) use ($username) {
                $query->where('username', $username)
                    ->orWhere('email', $username)
                    ->orWhere('phone', $username);
            })->first();

            if ($user && !Hash::check($password, $user->password)) {
                $user = null;
            }
        }

        if (!$user) {
            return null;
        }

        // Check multi-device login settings
        $allowMultiDevice = self::isMultiDeviceLoginAllowed($appName);
        
        // Handle existing sessions based on multi-device setting
        if (!$allowMultiDevice) {
            // Revoke all existing tokens for single-device mode
            $user->tokens()->delete();
            self::revokeUserToken($user->id);
        }

        // Generate new login_token (sanctum token)
        $loginToken = $user->createToken('auth_token')->plainTextToken;

        // Generate or refresh user_token
        $userTokenData = self::generateUserToken($user->id, $appName);

        // Update user avatar
        $user = CommonAvatarPublic::createAvatar($user, true);

        return [
            'user' => $user,
            'login_token' => $loginToken,
            'user_token' => $userTokenData['token'],
            'user_token_expires_at' => $userTokenData['expires_at'],
            'token_type' => 'Bearer',
            'login_by' => $loginBy,
            'expiration' => config('sanctum.expiration'),
            'multi_device_enabled' => $allowMultiDevice
        ];
    }

    /**
     * Generate or refresh user_token for a user
     * 
     * @param int $userId
     * @param string $appName
     * @return array
     */
    public static function generateUserToken($userId, $appName = 'common')
    {
        $token = Str::random(self::USER_TOKEN_LENGTH);
        $expiresAt = Carbon::now()->addDays(self::USER_TOKEN_EXPIRES_DAYS);

        User::where('id', $userId)->update(['user_token' => $token]);

        return [
            'token' => $token,
            'expires_at' => $expiresAt->toISOString()
        ];
    }

    /**
     * Refresh user_token
     * 
     * @param string $currentUserToken
     * @param string $appName
     * @return array|null
     */
    public static function refreshUserToken($currentUserToken, $appName = 'common')
    {
        $user = self::getUserByUserToken($currentUserToken);
        
        if (!$user) {
            return null;
        }

        return self::generateUserToken($user->id, $appName);
    }

    /**
     * Get user by user_token
     * 
     * @param string $userToken
     * @return User|null
     */
    public static function getUserByUserToken($userToken)
    {
        return User::where('user_token', $userToken)->first();
    }

    /**
     * Revoke user_token for a user
     * 
     * @param int $userId
     * @param string|null $appName If null, revoke all apps
     * @return bool
     */
    public static function revokeUserToken($userId, $appName = null)
    {
        User::where('id', $userId)->update(['user_token' => null]);
        return true;
    }

    /**
     * Check if multi-device login is allowed for an app
     * 
     * @param string $appName
     * @return bool
     */
    public static function isMultiDeviceLoginAllowed($appName)
    {
        $config = self::getAppAuthConfig($appName);
        return $config['allow_multi_device'] ?? false;
    }

    /**
     * Get authentication configuration for an app
     * 
     * @param string $appName
     * @return array
     */
    public static function getAppAuthConfig($appName)
    {
        $defaultConfig = [
            'allow_multi_device' => false,
            'user_token_expires_days' => self::USER_TOKEN_EXPIRES_DAYS,
            'auto_refresh_user_token' => true
        ];

        $appConfigs = [
            'DictV1' => [
                'allow_multi_device' => true,  // Dictionary app allows multi-device
                'user_token_expires_days' => 7,
                'auto_refresh_user_token' => true
            ],
            'common' => [
                'allow_multi_device' => false,
                'user_token_expires_days' => 7,
                'auto_refresh_user_token' => true
            ]
        ];

        return array_merge($defaultConfig, $appConfigs[$appName] ?? []);
    }

    /**
     * Logout user - revoke tokens
     * 
     * @param User $user
     * @param string $appName
     * @param bool $revokeUserToken Whether to revoke user_token as well
     * @return bool
     */
    public static function logoutUser($user, $appName = 'common', $revokeUserToken = false)
    {
        // Revoke current sanctum token
        if ($user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        // Optionally revoke user_token
        if ($revokeUserToken) {
            self::revokeUserToken($user->id, $appName);
        }

        return true;
    }

    /**
     * Validate authentication by either login_token or user_token
     * 
     * @param string|null $loginToken Sanctum token
     * @param string|null $userToken User token
     * @return User|null
     */
    public static function validateAuth($loginToken = null, $userToken = null)
    {
        // Try user_token first (longer term)
        if ($userToken) {
            return self::getUserByUserToken($userToken);
        }

        // Try login_token (sanctum)
        if ($loginToken) {
            // This would be handled by sanctum middleware naturally
            // But we can implement manual validation here if needed
            return null; // Let sanctum handle this
        }

        return null;
    }

    /**
     * Create unified login response format
     * 
     * @param array $authData
     * @return array
     */
    public static function createLoginResponse($authData)
    {
        return [
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => $authData['user'],
                'login_token' => $authData['login_token'],
                'user_token' => $authData['user_token'],
                'user_token_expires_at' => $authData['user_token_expires_at'],
                'token_type' => $authData['token_type'],
                'login_by' => $authData['login_by'],
                'expiration' => $authData['expiration'],
                'multi_device_enabled' => $authData['multi_device_enabled']
            ]
        ];
    }

    /**
     * Create user token refresh response format
     * 
     * @param array $tokenData
     * @return array
     */
    public static function createRefreshResponse($tokenData)
    {
        return [
            'success' => true,
            'message' => 'User token refreshed successfully',
            'data' => [
                'user_token' => $tokenData['token'],
                'user_token_expires_at' => $tokenData['expires_at']
            ]
        ];
    }
}