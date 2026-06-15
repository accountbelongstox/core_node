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

