<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\InviteCode;
use App\Support\InstallationAccessCode;
use App\Constants\AppKeys;
use App\Constants\InviteCodes;
use App\Services\UserSyncService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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
            'password' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'nickname' => ['nullable', 'string', 'max:255'],
            'name' => ['nullable', 'string', 'max:255'],
            'registration_code' => ['nullable', 'string'],
            'invite_code' => ['nullable', 'string'],
        ]);

        if ($this->checkUsernameIsExist($request->username)) {
            return $this->error('Username already exists', 400);
        }

        $roleLevel = 0;
        $roleName = 'user';
        $inviteCode = $request->registration_code ?? $request->invite_code ?? null;
        $invite = null;

        if ($inviteCode) {
            $canonicalAccessCode = trim((string) InstallationAccessCode::value());
            if ($canonicalAccessCode !== '' && hash_equals($canonicalAccessCode, trim((string) $inviteCode))) {
                $roleLevel = 100;
                $roleName = 'Super Administrator';
                Log::info('[Registration] Using start-generated super code', [
                    'username' => $request->username,
                    'role_level' => $roleLevel,
                    'role_name' => $roleName,
                ]);
            } elseif ($inviteCode === InviteCodes::APPQY2025) {
                // Fixed code grants regular user role (rolelevel 0)
                // This is for backward compatibility with the old AppQyV1 registration system
                Log::info('[Registration] Using fixed invite code APPQY2025', [
                    'code' => $inviteCode,
                    'username' => $request->username,
                    'role_level' => $roleLevel,
                    'role_name' => $roleName
                ]);
            } else {
                // Check database for invite code
                $invite = InviteCode::findByCode($inviteCode);

                if (!$invite) {
                    Log::warning('[Registration] Invalid invite code', [
                        'code' => $inviteCode,
                        'username' => $request->username
                    ]);
                    return $this->validationError(
                        ['registration_code' => ['Invalid invite code. Please check your code and try again.']],
                        'Invalid invite code'
                    );
                }

                if (!$invite->canBeUsed()) {
                    Log::warning('[Registration] Invite code cannot be used', [
                        'code' => $inviteCode,
                        'username' => $request->username,
                        'is_active' => $invite->is_active,
                        'used_count' => $invite->used_count,
                        'max_uses' => $invite->max_uses,
                        'expires_at' => $invite->expires_at
                    ]);
                    return $this->validationError(
                        ['registration_code' => ['Invite code is expired or already used.']],
                        'Invite code is expired or already used'
                    );
                }

                $roleLevel = $invite->getRoleLevel();
                $roleName = $invite->getRoleName();

                Log::info('[Registration] Using invite code', [
                    'code' => $inviteCode,
                    'type' => $invite->type,
                    'username' => $request->username,
                    'role_level' => $roleLevel,
                    'role_name' => $roleName
                ]);
            }
        }

        $user = User::createRecord([
            'username' => $request->username,
            'nickname' => $request->nickname,
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->string('password')),
            'rolelevel' => $roleLevel,
            'rolename' => $roleName,
        ]);

        if ($inviteCode && $invite) {
            $invite->use($user, $request->ip(), $request->ip(), $request->userAgent());
            Log::info('[Registration] Invite code used successfully', [
                'code' => $inviteCode,
                'user_id' => $user->id,
                'username' => $user->username
            ]);
        }

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
        $user = User::findByUsername($username);
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
            $validCode = InviteCodes::APPQY2025;
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
