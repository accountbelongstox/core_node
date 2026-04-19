<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Traits\ApiResponse;
use App\Constants\AuthErrorCodes;

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
            return $this->authErrorResponse(AuthErrorCodes::AUTH_VALIDATION_FAILED, 422);
        }

        $user = User::where('username', $request->username)
            ->orWhere('email', $request->username)
            ->first();

        if (!$user) {
            return $this->authErrorResponse(AuthErrorCodes::AUTH_USER_NOT_FOUND, 422);
        }

        if (!Hash::check($request->password, $user->password)) {
            return $this->authErrorResponse(AuthErrorCodes::AUTH_INVALID_PASSWORD, 422);
        }

        Auth::login($user, $request->boolean('remember'));

        $user = AvatarPublic::createAvatar($user, true);
        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->success([
            'token' => $token,
            'token_type' => 'Bearer',
            'expiration' => config('sanctum.expiration'),
            'user' => $user,
        ], 'Login successful');
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
}
