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
use Laravel\Sanctum\PersonalAccessToken;
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
            $user = User::findByUsernameEmailOrPhone($username);

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
            $user->revokeAllAccessTokens();
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
     * Verify username/email/phone + password against the canonical users table.
     * Keeps "user not found" and "wrong password" distinguishable for callers
     * that surface distinct error codes.
     *
     * @param string $identifier Username, email, or phone
     * @param string $password Plain-text password
     * @return array{status:string,user:User|null} status: ok|not_found|invalid_password
     */
    public static function verifyCredentials($identifier, $password)
    {
        $user = User::findByUsernameEmailOrPhone($identifier);

        if (!$user) {
            return ['status' => 'not_found', 'user' => null];
        }

        if (!Hash::check($password, $user->password)) {
            return ['status' => 'invalid_password', 'user' => null];
        }

        return ['status' => 'ok', 'user' => $user];
    }

    /**
     * Issue a Sanctum login token for an already-authenticated user, ensuring the
     * avatar/nickname defaults are populated first (single avatar pipeline).
     *
     * @param User $user
     * @param string $tokenName Sanctum token name
     * @return array{user:User,token:string,token_type:string,expiration:mixed}
     */
    public static function issueLoginToken(User $user, $tokenName = 'auth_token')
    {
        $user = CommonAvatarPublic::createAvatar($user, true);
        $token = $user->createToken($tokenName)->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
            'token_type' => 'Bearer',
            'expiration' => config('sanctum.expiration'),
        ];
    }

    /**
     * Resolve a Sanctum personal access token (plain-text) to its user, applying
     * the same expiry rules as the Sanctum guard. App-neutral: usable by callers
     * that receive the token on a non-Authorization header.
     *
     * @param string|null $loginToken Plain-text Sanctum token
     * @return User|null
     */
    public static function getUserByLoginToken($loginToken)
    {
        if (!$loginToken) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($loginToken);

        if (!$accessToken) {
            return null;
        }

        $user = $accessToken->tokenable;

        if (!$user instanceof User) {
            return null;
        }

        $expiresAt = $accessToken->expires_at;

        if ($expiresAt === null) {
            $expirationMinutes = config('sanctum.expiration');
            if ($expirationMinutes) {
                $expiresAt = $accessToken->created_at->addMinutes($expirationMinutes);
            }
        }

        if ($expiresAt !== null && $expiresAt->isPast()) {
            return null;
        }

        return $user;
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

        User::updateById((int) $userId, ['user_token' => $token]);

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
        return User::findByUserToken((string) $userToken);
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
        User::updateById((int) $userId, ['user_token' => null]);
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
        $user->revokeCurrentAccessToken();

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

        // Try login_token (sanctum personal access token)
        if ($loginToken) {
            return self::getUserByLoginToken($loginToken);
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
