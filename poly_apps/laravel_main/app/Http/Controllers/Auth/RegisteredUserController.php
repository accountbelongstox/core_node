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

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Constants\AppKeys;
use App\Services\UserSyncService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Traits\ApiResponse;

/**
 * NO ?? or || allowed - use explicit if statements
 */
class RegisteredUserController extends Controller
{
    use ApiResponse;
    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function apiStore(Request $request): Response | JsonResponse
    {
        $request->validate([
            'username' => ['required', 'string', 'max:255'],
            // 'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'string', 'max:255'],
        ]);
        if ($this->checkUsernameIsExist($request->username)) {
            return $this->error('Username already exists', 400);
        }
        $user = User::create([
            'username' => $request->username,
            'nickname' => $request->nickname,
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->string('password')),
        ]);
        $user = AvatarPublic::createAvatar($user);
        event(new Registered($user));

        $token = $user->createToken('auth_token')->plainTextToken;
        return $this->success([
            'token' => $token,
            'token_type' => 'Bearer',
            'expiration' => config('sanctum.expiration'),
            'uid' => $user->id,
            'user' => $user,
        ], 'User registered successfully');
    }

    public function checkUsernameIsExist($username)
    {
        $user = User::where('username', $username)->first();
        if ($user) {
            return true;
        }
        return false;
    }
    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): Response | JsonResponse
    {
        $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'invitation_code' => ['required', 'string'],
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'lowercase', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);
        
        $invitationCodeFile = \App\Providers\PathMapper::getLaravelDataDir() . '/app_qy_v1_invitation_code.json';
        if (file_exists($invitationCodeFile)) {
            $data = json_decode(file_get_contents($invitationCodeFile), true);
            $validCode = 'APPQY2025';
            if (isset($data['invitation_code'])) {
                $validCode = $data['invitation_code'];
            }

            if ($request->invitation_code !== $validCode) {
                return $this->validationError(['invitation_code' => ['Invalid invitation code']], 'Invalid invitation code');
            }
        }
        
        $email = $request->email;
        if (empty($email) && filter_var($request->username, FILTER_VALIDATE_EMAIL)) {
            $email = $request->username;
        }
        
        $credentials = [
            'username' => $request->username,
            'email' => $email,
            'phone' => $request->phone,
            'name' => $request->name,
            'password' => $request->password,
            'sub_app_data' => [
                'credit' => 0,
            ],
        ];
        
        $result = \App\Services\UnifiedAuthService::register($credentials, AppKeys::APPQYV1);

        if (!$result['success']) {
            return $this->error($result['error'], 422);
        }

        $user = $result['user'];
        event(new Registered($user));
        Auth::login($user);

        if ($request->wantsJson()) {
            return $this->success(['user' => $user], 'Registration successful');
        }

        return response()->noContent();
    }
}
