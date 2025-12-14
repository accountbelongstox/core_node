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

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController as DGroupAPublic;
use App\Utils\StrTool;
use App\Traits\ApiResponse;
class AppQyV1AuthenticationUserLoginController
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
    public static function loginByUserToken($userAuthToken)
    {
        $user = User::where('user_token', $userAuthToken)->first();
        if ($user) {
            Auth::login($user);
            return $user;
        }
        return null;
    }

    public static function loginByUsernamePassword($username, $password)
    {
        $user = User::where('username', $username)->first();
        if ($user) {
            if (Hash::check($password, $user->password)) {
                Auth::login($user);
                return $user;
            }
        }
        return null;
    }


}

