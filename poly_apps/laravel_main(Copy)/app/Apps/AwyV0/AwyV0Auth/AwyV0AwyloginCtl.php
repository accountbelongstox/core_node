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


namespace App\Apps\AwyV0\AwyV0Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Hash;
use App\AwyV0\Controller;
use Laravolt\Avatar\Avatar;
use App\AwyV0\Auth\AuthPublic\UserLogin;
use App\AwyV0\Auth\AuthPublic\UserInitEnsure;
use App\AwyV0\Auth\AvatarPublic;
use App\AwyV0\Gvar\Gvar;
class AwyV0AwyloginCtl extends Controller
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
            $loginBy = "usr-pwd";
            if ($userAuthToken) {
                $user = UserLogin::loginByUserToken($userAuthToken);
                $loginBy = "user-auth-token";
            } else {
                $user = UserLogin::loginByUsernamePassword($username, $password);
            }
            if (!$user) {
                throw ValidationException::withMessages([
                    'username' => [__('auth.failed')],
                ]);
            }
            $user = AvatarPublic::createAvatar($user,true);
            $token = $user->createToken('auth_token')->plainTextToken;
            UserInitEnsure::ensureUserDefault($user->id, $user->username);
            return response()->json([
                'token' => $token,
                'login_by' => $loginBy,
                'token_type' => 'Bearer',
                "expiration" => config('sanctum.expiration'),
                'user' => $user,
            ]);
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

        UserInitEnsure::ensureUserDefault($user->id, $user->username);
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
}
