<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Controller;
use App\Http\Common\CommonAuthService;
use App\Traits\ApiResponse;
use App\Constants\ErrorCodes;

/**
 * NO try-catch allowed - trust Laravel validation
 * NO ?? or || allowed - use explicit if statements
 */
class LoginController extends Controller
{
    use ApiResponse;

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        if (!$credentials) {
            return $this->authErrorResponse(ErrorCodes::AUTH_VALIDATION_FAILED, 422);
        }

        $check = CommonAuthService::verifyCredentials($request->username, $request->password);

        if ($check['status'] === 'not_found') {
            return $this->authErrorResponse(ErrorCodes::AUTH_USER_NOT_FOUND, 422);
        }

        if ($check['status'] === 'invalid_password') {
            return $this->authErrorResponse(ErrorCodes::AUTH_INVALID_PASSWORD, 422);
        }

        $user = $check['user'];

        Auth::login($user, $request->boolean('remember'));

        $session = CommonAuthService::issueLoginToken($user);

        return $this->success([
            'token' => $session['token'],
            'token_type' => $session['token_type'],
            'expiration' => $session['expiration'],
            'user' => $session['user'],
        ], 'Login successful');
    }

    public function logout(Request $request)
    {
        $request->user()?->revokeCurrentAccessToken();

        return response()->json([
            'message' => 'Successfully logged out'
        ],200);
    }
}
