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

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use App\Http\Common\CommonUserGen;
use App\Models\InviteCode;
use App\Traits\ApiResponse;

class AppQyV1AuthenticationRegistrationController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function apiStore(Request $request): Response | JsonResponse
    {
            $request->validate([
                'username' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'min:6', 'max:255'],
            ]);

            if (CommonUserGen::checkUsernameIsExist($request->username)) {
                return response()->json([
                    'message' => 'Username already exists',
                    'code' => 400,
                    'status' => 'error',
                ], 400);
            }

            $email = "";
            if (isset($request->email)) {
                $email = $request->email;
            }
            $nickname = "";
            if (isset($request->nickname)) {
                $nickname = $request->nickname;
            }
            $name = "";
            if (isset($request->name)) {
                $name = $request->name;
            }
            $inviteCode = $request->registration_code ?? null;
            if (isset($request->invite_code)) {
                $inviteCode = $request->invite_code;
            }

            $roleLevel = 0;
            $roleName = 'user';

            if ($inviteCode) {
                $invite = InviteCode::where('code', $inviteCode)->first();

                if (!$invite) {
                    \Log::warning('[AppQyV1Registration] Invalid invite code', [
                        'code' => $inviteCode,
                        'username' => $request->username
                    ]);
                    return response()->json([
                        'message' => 'Invalid invite code',
                        'code' => 400,
                        'status' => 'error',
                    ], 400);
                }

                if (!$invite->canBeUsed()) {
                    \Log::warning('[AppQyV1Registration] Invite code cannot be used', [
                        'code' => $inviteCode,
                        'username' => $request->username,
                        'is_active' => $invite->is_active,
                        'used_count' => $invite->used_count,
                        'max_uses' => $invite->max_uses,
                        'expires_at' => $invite->expires_at
                    ]);
                    return response()->json([
                        'message' => 'Invite code is expired or already used',
                        'code' => 400,
                        'status' => 'error',
                    ], 400);
                }

                $roleLevel = $invite->getRoleLevel();
                $roleName = $invite->getRoleName();

                \Log::info('[AppQyV1Registration] Using invite code', [
                    'code' => $inviteCode,
                    'type' => $invite->type,
                    'username' => $request->username,
                    'role_level' => $roleLevel,
                    'role_name' => $roleName
                ]);
            }

            $userData = CommonUserGen::createUser(
                $request->username,
                $request->password,
                $email,
                $nickname,
                $name,
                'AppQyV1',
                $roleLevel,
                $roleName
            );

            if (!$userData) {
                \Log::error('[AppQyV1Registration] Registration failed for user', [
                    'username' => $request->username
                ]);
                return response()->json([
                    'message' => 'Registration failed. Please check the logs or try again.',
                    'code' => 500,
                    'status' => 'error',
                ], 500);
            }

            if ($inviteCode && isset($invite)) {
                $user = $userData['user'];
                $invite->use($user);

                \Log::info('[AppQyV1Registration] Invite code used successfully', [
                    'code' => $inviteCode,
                    'user_id' => $user->id,
                    'username' => $user->username,
                    'role_level' => $roleLevel,
                    'role_name' => $roleName
                ]);
            }

        $user = $userData['user'];
        $token = $userData['token'];
        $expiration = $userData['expiration'];
        $uid = $userData['uid'];
        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            "expiration" => $expiration,
            'uid' => $uid,
            "user" => $user,
            'message' => 'User registered successfully',
            'code' => 200,
            'status' => 'success',
        ], 200);
    }
}

