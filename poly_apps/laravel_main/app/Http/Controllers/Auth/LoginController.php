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


namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\Controller;
use Laravolt\Avatar\Avatar;
use App\Traits\ApiResponse;

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
            return $this->validationError("must be required username and password", 'Invalid credentials');
        }

        $user = User::where('username', $request->username)->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'username' => [__('auth.failed')],
            ]);
        }

        if (!Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => [__('auth.failed')],
            ]);
        }

        if (!Auth::attempt(['username' => $request->username, 'password' => $request->password], $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'username' => [__('auth.failed')],
            ]);
        }

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
