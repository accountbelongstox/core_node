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


namespace App\Apps\DictV1\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Hash;
use Laravolt\Avatar\Avatar;
use App\Http\Common\CommonAvatarPublic;
use App\Http\Common\CommonAuthService;
use App\Apps\DictV1\DictV1Gvar\Gvar;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1WordGroupPublicController;
use Illuminate\Routing\Controller as BaseController;
class DictV1AuthenticationLoginController extends BaseController
{
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
            $authData = CommonAuthService::authenticateUser($username, $password, 'DictV1', $userAuthToken);
            
            if (!$authData) {
                throw ValidationException::withMessages([
                    'username' => [__('auth.failed')],
                ]);
            }

            // Ensure default word group exists
            DictV1WordGroupPublicController::ensureDefaultGroupIfNotExist($authData['user']->id, $authData['user']->username);
            
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

        DictV1WordGroupPublicController::ensureDefaultGroupIfNotExist($user->id, $user->username);
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

        $tokenData = CommonAuthService::refreshUserToken($userToken, 'DictV1');
        
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
