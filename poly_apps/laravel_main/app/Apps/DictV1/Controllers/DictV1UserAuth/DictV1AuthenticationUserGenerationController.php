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


namespace App\Apps\DictV1\Controllers\DictV1UserAuth;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1WordGroupPublicController as DGroupAPublic;
use App\Utils\StrTool;
class DictV1AuthenticationUserGenerationController
{
    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public static function createUser($username, $password, $email="", $nickname="", $name="")
    {
        if (self::checkUsernameIsExist($username)) {
            return null;
        }
        $user = User::create([
            'username' => $username,
            'nickname' => $nickname,
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
        ]);
        DGroupAPublic::ensureDefaultGroupIfNotExist($user->id, $user->username);
        $user = AvatarPublic::createAvatar($user);
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
        $user = User::where('username', $username)->first();
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
