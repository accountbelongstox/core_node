<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Http\Common\CommonUserGen;
use App\Models\InviteCode;
use App\Models\User;
use App\Traits\ApiResponse;
use App\Services\UnifiedAuthService;
use App\Constants\AppKeys;
use App\Services\AvatarService;
use App\Http\Common\CommonAuthService;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;

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
        Log::info('[AppQyV1Registration] Registration request received', [
            'username' => $request->username,
            'has_email' => $request->has('email'),
            'has_invite_code' => $request->has('invite_code') || $request->has('registration_code'),
            'request_id' => uniqid('reg_', true)
        ]);

        $request->validate([
            'username' => ['required', 'string', 'max:255'],
            // [Removed] Password 'min:6' validation removed - no minimum requirement
            'password' => ['required', 'string', 'max:255'],
            // Optional learning-language selection (multi-select) and native
            // language. Codes are revalidated against the supported-language
            // catalog below; unknown codes are dropped rather than rejected.
            'learning_languages' => ['sometimes', 'array'],
            'learning_languages.*' => ['string', 'max:10'],
            'native_language' => ['sometimes', 'string', 'max:10'],
        ]);

        if (CommonUserGen::checkUsernameIsExist($request->username)) {
            Log::info('[AppQyV1Registration] Username already exists', ['username' => $request->username]);
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
                Log::warning('[AppQyV1Registration] Invalid invite code', [
                    'code' => $inviteCode,
                    'username' => $request->username
                ]);
                return $this->error('Invalid invite code', 400);
            }

            if (!$invite->canBeUsed()) {
                Log::warning('[AppQyV1Registration] Invite code cannot be used', [
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

            Log::info('[AppQyV1Registration] Using invite code', [
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

        // AppKeys::APPQYV1 === 'appqyv1', the connection key defined in
        // config/database.php. Passing the PascalCase literal 'AppQyV1' here
        // caused "Database connection [AppQyV1] not configured." (the
        // UnifiedAuthService 2nd arg is used as $userModel->setConnection()).
        $unifiedResult = UnifiedAuthService::register($credentials, AppKeys::APPQYV1);

        if (!$unifiedResult['success']) {
            $errorMessage = $unifiedResult['error'];

            Log::error('[AppQyV1Registration] Registration failed', [
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
        $user = \App\Http\Common\CommonAvatarPublic::createAvatar($user, true);
        event(new \Illuminate\Auth\Events\Registered($user));

        if ($inviteCode && isset($invite)) {
            $invite->use($user);

            Log::info('[AppQyV1Registration] Invite code used successfully', [
                'code' => $inviteCode,
                'user_id' => $user->id,
                'username' => $user->username,
                'role_level' => $roleLevel,
                'role_name' => $roleName
            ]);
        }

        // Persist the chosen learning languages (multi-select) and native
        // language. Each code is validated against the supported-language
        // catalog (AppQyV1LanguageConfigService); unknown codes are dropped so a
        // bad value never reaches storage. When none is supplied the downstream
        // default of ['en'] is used (see below).
        $supportedLanguages = AppQyV1LanguageConfigService::getTTSLanguages();

        $selectedLearningLanguages = [];
        if ($request->has('learning_languages') && is_array($request->learning_languages)) {
            foreach ($request->learning_languages as $languageCodeInput) {
                if (is_string($languageCodeInput) && isset($supportedLanguages[$languageCodeInput])) {
                    if (!in_array($languageCodeInput, $selectedLearningLanguages, true)) {
                        $selectedLearningLanguages[] = $languageCodeInput;
                    }
                }
            }
        }

        $needsSave = false;
        if (!empty($selectedLearningLanguages)) {
            $user->learning_languages = $selectedLearningLanguages;
            $needsSave = true;
        }
        if ($request->has('native_language') && is_string($request->native_language)) {
            if (isset($supportedLanguages[$request->native_language])) {
                $user->native_language = $request->native_language;
                $needsSave = true;
            }
        }
        if ($needsSave) {
            $user->save();
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

        Log::info('[AppQyV1Registration] Registration successful', [
            'user_id' => $user->id,
            'username' => $user->username,
            'role_level' => $roleLevel,
            'role_name' => $roleName
        ]);

        return $this->success($responseData, 'User registered successfully');
    }
}
