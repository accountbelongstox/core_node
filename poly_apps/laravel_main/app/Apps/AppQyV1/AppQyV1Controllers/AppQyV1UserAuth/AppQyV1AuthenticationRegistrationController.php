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
use App\Models\User;
use App\Traits\ApiResponse;
use App\Services\UnifiedAuthService;
use App\Services\AvatarService;
use App\Http\Common\CommonAuthService;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;

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
        \Log::info('[AppQyV1Registration] Registration request received', [
            'username' => $request->username,
            'has_email' => $request->has('email'),
            'has_invite_code' => $request->has('invite_code') || $request->has('registration_code'),
            'request_id' => uniqid('reg_', true)
        ]);

        $request->validate([
            'username' => ['required', 'string', 'max:255'],
            // [Removed] Password 'min:6' validation removed - no minimum requirement
            'password' => ['required', 'string', 'max:255'],
        ]);

        if (CommonUserGen::checkUsernameIsExist($request->username)) {
            \Log::info('[AppQyV1Registration] Username already exists', ['username' => $request->username]);
            return $this->error('Username already exists', 400);
        }

        $email = "";
        if (isset($request->email)) {
            $email = $request->email;
        }
        $nickname = null;
        if (isset($request->nickname) && !empty($request->nickname)) {
            $nickname = $request->nickname;
        }
        $name = "";
        if (isset($request->name)) {
            $name = $request->name;
        }

        if ($email === "") {
            if (filter_var($request->username, FILTER_VALIDATE_EMAIL)) {
                $email = $request->username;
            }
        }

        $phone = null;
        if ($request->has('phone')) {
            $phone = $request->input('phone');
        } else {
            $usernameValue = $request->username;
            if (preg_match('/^[0-9+\-\s]{6,}$/', $usernameValue)) {
                $phone = $usernameValue;
            }
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
                return $this->error('Invalid invite code', 400);
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
                return $this->error('Invite code is expired or already used', 400);
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

        $credentials = [
            'username' => $request->username,
            'email' => !empty($email) ? $email : null,
            'phone' => $phone,
            'name' => !empty($name) ? $name : null,
            'password' => $request->password,
            'rolelevel' => $roleLevel,
            'rolename' => $roleName,
            'sub_app_data' => [
                'nickname' => !empty($nickname) ? $nickname : null,
                'credit' => 0,
            ],
        ];

        $unifiedResult = UnifiedAuthService::register($credentials, 'AppQyV1');

        if (!$unifiedResult['success']) {
            $errorMessage = $unifiedResult['error'];

            \Log::error('[AppQyV1Registration] Registration failed', [
                'username' => $request->username,
                'email' => $email,
                'error' => $errorMessage,
            ]);

            if (strpos(strtolower($errorMessage), 'already exists') !== false) {
                if (!empty($email) && User::where('email', $email)->exists()) {
                    $errorMessage = 'Email already exists';
                } else {
                    $errorMessage = 'Username already exists';
                }
            }

            return $this->error($errorMessage, 400);
        }

        $user = $unifiedResult['user'];
        $user = \App\Http\Common\CommonAvatarPublic::createAvatar($user);
        event(new \Illuminate\Auth\Events\Registered($user));

        if ($inviteCode && isset($invite)) {
            $invite->use($user);

            \Log::info('[AppQyV1Registration] Invite code used successfully', [
                'code' => $inviteCode,
                'user_id' => $user->id,
                'username' => $user->username,
                'role_level' => $roleLevel,
                'role_name' => $roleName
            ]);
        }

        AppQyV1WordGroupPublicController::ensureDefaultGroupIfNotExist($user->id, $user->username);

        $loginToken = $user->createToken('auth_token')->plainTextToken;
        $userTokenData = CommonAuthService::generateUserToken($user->id, 'AppQyV1');

        $learningLanguages = ['en'];
        if (isset($user->learning_languages)) {
            $learningLanguages = $user->learning_languages;
        }
        $nativeLanguage = 'zh';
        if (isset($user->native_language)) {
            $nativeLanguage = $user->native_language;
        }

        $langCode = !empty($learningLanguages) ? $learningLanguages[0] : 'en';
        $learningStats = AppQyV1UserLearningProgressModel::getUserStats($user->id, $langCode);

        $responseData = [
            'login_token' => $loginToken,
            'user_token' => $userTokenData['token'],
            'user_token_expires_at' => $userTokenData['expires_at'],
            'token_type' => 'Bearer',
            'token' => $loginToken,
            'expiration' => config('sanctum.expiration'),
            'uid' => $user->id,
            'login_by' => 'registration',
            'multi_device_enabled' => CommonAuthService::isMultiDeviceLoginAllowed('AppQyV1'),
            'user' => $user,
        ];

        $responseData['user']->learning_languages = $learningLanguages;
        $responseData['user']->native_language = $nativeLanguage;
        $responseData['user']->learning_stats = $learningStats;

        if (isset($user->avatar)) {
            $responseData['user']->avatar_url = AvatarService::getAvatarUrl($user->avatar);
        }

        if (isset($learningStats['stats'])) {
            $stats = $learningStats['stats'];
            $responseData['user']->total_words = $stats['total'] ?? $stats['total_words'] ?? 0;
            $responseData['user']->learned_words = $stats['learned'] ?? $stats['learned_words'] ?? 0;
            $responseData['user']->mastered_words = $stats['mastered'] ?? $stats['mastered_words'] ?? 0;
            $responseData['user']->review_due_words = $stats['review_due'] ?? $stats['review_due_words'] ?? 0;
            $responseData['user']->today_new_words = $stats['today_learned'] ?? 0;
            $responseData['user']->today_review_words = $stats['today_reviewed'] ?? 0;
            $responseData['user']->streak_days = $stats['streak_days'] ?? 0;
            $responseData['user']->study_days = $stats['study_days'] ?? 0;
        }

        \Log::info('[AppQyV1Registration] Registration successful', [
            'user_id' => $user->id,
            'username' => $user->username,
            'role_level' => $roleLevel,
            'role_name' => $roleName
        ]);

        return $this->success($responseData, 'User registered successfully');
    }
}
