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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravolt\Avatar\Avatar;
use App\Http\Common\CommonAvatarPublic;
use App\Http\Common\CommonAuthService;
use App\Apps\AppQyV1\AppQyV1Gvar\Gvar;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController;
use Illuminate\Routing\Controller as BaseController;
class AppQyV1AuthenticationLoginController extends BaseController
{
    /**
     * Send SMS verification code
     */
    public function sendSmsCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phoneNumber' => 'required|string|regex:/^[0-9\+\-\s]+$/',
            'countryCode' => 'string|default:+86'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_PHONE_NUMBER',
                    'message' => 'Invalid phone number format'
                ]
            ], 422);
        }

        $phoneNumber = $request->input('phoneNumber');
        $countryCode = $request->input('countryCode', '+86');

        // Rate limiting check
        $rateLimitKey = 'sms_send_' . str_replace(['+', '-', ' '], '', $phoneNumber);

        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TOO_MANY_ATTEMPTS',
                    'message' => 'Too many SMS requests. Please wait before trying again.'
                ]
            ], 429);
        }

        RateLimiter::hit($rateLimitKey, 60);

        // Generate verification code
        $verificationCode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $verificationId = Str::uuid();

        // Store verification code in cache (in production, use database)
        cache()->put("sms_code_{$verificationId}", [
            'phone' => $phoneNumber,
            'code' => $verificationCode,
            'attempts' => 0,
            'expires_at' => now()->addSeconds(60)
        ], 60);

        $responseData = [
            'success' => true,
            'data' => [
                'verificationId' => $verificationId,
                'timeoutSeconds' => 60
            ]
        ];

        // In development mode, return the code for testing
        if (config('app.debug')) {
            $responseData['data']['developmentCode'] = $verificationCode;
        }

        // TODO: Integrate with actual SMS service
        // $this->sendSms($phoneNumber, $verificationCode);

        return response()->json($responseData);
    }

    /**
     * Verify SMS code and login/register user
     */
    public function verifySmsCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phoneNumber' => 'required|string|regex:/^[0-9\+\-\s]+$/',
            'verificationCode' => 'required|string|digits:6'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CODE',
                    'message' => 'Invalid verification code format'
                ]
            ], 422);
        }

        $phoneNumber = $request->input('phoneNumber');
        $verificationCode = $request->input('verificationCode');

        // Find verification record
        $verificationRecords = cache()->get("sms_code_*");
        $validRecord = null;

        foreach ($verificationRecords as $key => $record) {
            if ($record['phone'] === $phoneNumber && $record['code'] === $verificationCode) {
                if ($record['expires_at']->isFuture() && $record['attempts'] < 3) {
                    $validRecord = $record;
                    cache()->forget($key);
                    break;
                }
            }
        }

        if (!$validRecord) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CODE',
                    'message' => 'Invalid or expired verification code'
                ]
            ], 401);
        }

        try {
            // Find or create user
            $user = User::where('phone', $phoneNumber)->first();

            if (!$user) {
                $user = User::create([
                    'phone' => $phoneNumber,
                    'display_name' => 'User_' . substr($phoneNumber, -4),
                    'provider' => 'phone',
                    'is_verified' => true,
                    'is_active' => true,
                    'last_login_at' => now()
                ]);
            } else {
                $user->update(['last_login_at' => now()]);
            }

            // Create authentication tokens
            $accessToken = $user->createToken('app_qy_access')->plainTextToken;
            $refreshToken = Str::random(80);

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'phone' => $user->phone,
                        'displayName' => $user->display_name,
                        'avatar' => $user->avatar,
                        'provider' => $user->provider ?? 'phone',
                        'createdAt' => $user->created_at->toISOString(),
                        'lastLoginAt' => $user->last_login_at->toISOString()
                    ],
                    'token' => [
                        'accessToken' => $accessToken,
                        'refreshToken' => $refreshToken,
                        'tokenType' => 'Bearer',
                        'expiresIn' => 86400
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'SERVICE_UNAVAILABLE',
                    'message' => 'Authentication failed'
                ]
            ], 500);
        }
    }

    /**
     * WeChat OAuth login
     */
    public function wechatLogin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
            'state' => 'string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CREDENTIALS',
                    'message' => 'WeChat authorization code is required'
                ]
            ], 422);
        }

        // In development mode, simulate WeChat login
        if (config('app.debug')) {
            $mockUser = [
                'id' => 'dev_' . time(),
                'phone' => '13800138000',
                'displayName' => 'Dev User',
                'avatar' => 'https://via.placeholder.com/100',
                'provider' => 'wechat'
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => $mockUser,
                    'token' => [
                        'accessToken' => 'dev_token_' . Str::random(40),
                        'refreshToken' => 'dev_refresh_' . Str::random(40),
                        'tokenType' => 'Bearer',
                        'expiresIn' => 86400
                    ]
                ],
                'mock' => true
            ]);
        }

        // TODO: Implement actual WeChat OAuth integration
        return response()->json([
            'success' => false,
            'error' => [
                'code' => 'SERVICE_UNAVAILABLE',
                'message' => 'WeChat integration not available yet'
            ]
        ], 501);
    }

    /**
     * Get WeChat authorization URL
     */
    public function getWechatAuthUrl(Request $request)
    {
        $redirectUri = $request->input('redirect_uri', url('/api/auth/wechat/callback'));
        $state = $request->input('state', Str::random(32));

        $authUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize?' . http_build_query([
            'appid' => env('WECHAT_APP_ID', 'mock_app_id'),
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'snsapi_userinfo',
            'state' => $state
        ]) . '#wechat_redirect';

        return response()->json([
            'success' => true,
            'data' => [
                'authUrl' => $authUrl,
                'state' => $state
            ]
        ]);
    }

    /**
     * Refresh access token
     */
    public function refreshToken(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'refreshToken' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHORIZED',
                    'message' => 'Refresh token is required'
                ]
            ], 401);
        }

        // TODO: Implement token refresh logic
        return response()->json([
            'success' => false,
            'error' => [
                'code' => 'TOKEN_EXPIRED',
                'message' => 'Token refresh not implemented yet'
            ]
        ], 501);
    }

    /**
     * Get current user
     */
    public function getCurrentUser(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => auth()->id(),
                    'phone' => auth()->user()->phone,
                    'displayName' => auth()->user()->display_name,
                    'avatar' => auth()->user()->avatar,
                    'provider' => auth()->user()->provider ?? 'unknown'
                ]
            ]
        ]);
    }

    public function login(Request $request)
    {
        try {
            $username = $request->input('username');
            $password = $request->input('password');
            $userAuthToken = $request->header(Gvar::AuthUserToken);
            
            if (!$username && !$password && !$userAuthToken) {
                return response()->json([
                    'message' => 'Invalid credentials',
                    'errors' => "must be required username and password or user-auth-token",
                ], 422);
            }

            // Use unified authentication service
            $authData = CommonAuthService::authenticateUser($username, $password, 'AppQyV1', $userAuthToken);
            
            if (!$authData) {
                throw ValidationException::withMessages([
                    'username' => [__('auth.failed')],
                ]);
            }

            // Ensure default word group exists
            AppQyV1WordGroupPublicController::ensureDefaultGroupIfNotExist($authData['user']->id, $authData['user']->username);
            
            // Create unified response
            $response = CommonAuthService::createLoginResponse($authData);
            
            // Add legacy compatibility fields
            $response['token'] = $authData['login_token']; // Legacy field name
            $response['login_by'] = $authData['login_by']; // Legacy field name
            
            return response()->json($response);
            
        } catch (ValidationException $e) {
            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'Invalid credentials or username or password or user-auth-token',
                    'errors' => $e->errors(),
                ], 422);
            }
            throw $e;
        }
    }

    public function loginByUserToken($userAuthToken)
    {
        $user = User::where('user_token', $userAuthToken)->first();

        AppQyV1WordGroupPublicController::ensureDefaultGroupIfNotExist($user->id, $user->username);
        if ($user) {
            Auth::login($user);
            return response()->json([
                'message' => 'Successfully logged in',
                'user' => $user,
            ], 200);
        }
        return response()->json([
            'message' => 'User not found',
        ], 404);
    }

    public function logout(Request $request)
    {
        if ($request->user()) {
            if ($request->wantsJson()) {
                // Only attempt to delete the token if it's not a transient token
                $currentToken = $request->user()->currentAccessToken();
                if ($currentToken && !($currentToken instanceof \Laravel\Sanctum\TransientToken)) {
                    $currentToken->delete();
                }
                return response()->json([
                    'message' => 'Successfully logged out'
                ],200);
            }

            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'message' => 'Successfully logged out'
        ],200);
    }

    /**
     * Refresh user_token
     */
    public function refreshUserToken(Request $request)
    {
        $userToken = $request->header(Gvar::AuthUserToken) ?? $request->input('user_token');
        
        if (!$userToken) {
            return response()->json([
                'message' => 'User token is required',
                'errors' => 'Please provide user_token in header or request body'
            ], 422);
        }

        $tokenData = CommonAuthService::refreshUserToken($userToken, 'AppQyV1');
        
        if (!$tokenData) {
            return response()->json([
                'message' => 'Invalid or expired user token',
                'errors' => 'The provided user token is invalid or has expired'
            ], 401);
        }

        return response()->json(CommonAuthService::createRefreshResponse($tokenData));
    }

    /**
     * Get user info by user_token (for authentication check)
     */
    public function getUserByToken(Request $request)
    {
        $userToken = $request->header(Gvar::AuthUserToken) ?? $request->input('user_token');
        
        if (!$userToken) {
            return response()->json([
                'message' => 'User token is required'
            ], 422);
        }

        $user = CommonAuthService::getUserByUserToken($userToken);
        
        if (!$user) {
            return response()->json([
                'message' => 'Invalid or expired user token'
            ], 401);
        }

        $user = CommonAvatarPublic::createAvatar($user, false);
        
        return response()->json([
            'success' => true,
            'message' => 'User found',
            'data' => [
                'user' => $user,
                'authenticated' => true
            ]
        ]);
    }
}

