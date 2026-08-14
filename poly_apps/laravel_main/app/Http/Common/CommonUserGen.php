<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\Common;

use App\Models\User;
use App\Services\UnifiedAuthService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Http\Common\CommonAvatarPublic;
use App\Utils\StrTool;

class CommonUserGen
{
    /**
     * Create a new user
     *
     * Creates user in main users table and optionally in sub-app users table.
     * If nickname is not provided or empty, a random nickname will be auto-generated
     * using Haikunator (e.g., "wispy-dust-1337").
     *
     * @param string $username
     * @param string $password
     * @param string $email
     * @param string|null $nickname Auto-generated if not provided
     * @param string $name
     * @param string|null $subAppConnection
     * @param int $roleLevel
     * @param string $roleName
     * @return array|null
     */
    public static function createUser($username, $password, $email = "", $nickname = null, $name = "", $subAppConnection = null, $roleLevel = 0, $roleName = 'user')
    {
        $credentials = [
            'username' => $username,
            'email' => !empty($email) ? $email : null,
            'phone' => null,
            'name' => !empty($name) ? $name : null,
            'password' => $password,
            'rolelevel' => $roleLevel,
            'rolename' => $roleName,
            'sub_app_data' => [
                'nickname' => !empty($nickname) ? $nickname : null,
                'credit' => 0,
            ],
        ];

        $result = UnifiedAuthService::register($credentials, $subAppConnection);

        if (!$result['success']) {
            \Log::error('[CommonUserGen] User creation failed', [
                'username' => $username,
                'error' => $result['error'] ?? 'Unknown error'
            ]);
            return null;
        }

        $user = $result['user'];
        $user = CommonAvatarPublic::createAvatar($user);
        event(new Registered($user));

        $token = $user->createToken('auth_token')->plainTextToken;
        return [
            'token' => $token,
            "expiration" => config('sanctum.expiration'),
            'uid' => $user->id,
            "user" => $user,
        ];
    }

    public static function checkUsernameIsExist($username)
    {
        $user = User::findByUsername($username);
        if ($user) {
            return true;
        }
        return false;
    }

    public static function randomGenUsername(){
        $username = StrTool::genUsername();
        $password = StrTool::genPassword();
        $userData = self::createUser($username, $password);
        while($userData == null){
            $username = StrTool::genUsername();
            $password = StrTool::genPassword();
            $userData = self::createUser($username, $password);
        }
        return $userData;
    }

}
