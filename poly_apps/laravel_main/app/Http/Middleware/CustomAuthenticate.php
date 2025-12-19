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


namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Http\Middleware\MidPublic\ApiDebugTokenAuth;
use App\Http\Common\CommonUserGen;
use App\Http\Common\CommonGvar;

class CustomAuthenticate extends Middleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string[]  ...$guards
     * @return mixed
     *
     * @throws \Illuminate\Auth\AuthenticationException
     */
    public function handle($request, Closure $next, ...$guards)
    {
        // First check for Bearer token (Sanctum token from login)
        $bearerToken = $request->bearerToken();
        if ($bearerToken) {
            if (Auth::guard('sanctum')->check()) {
                return $next($request);
            }
        }
        $user = null;
        $userToken = $request->header(CommonGvar::AuthUserToken);
        if ($userToken) {
            $user = User::where('user_token', $userToken)->first();
            if ($user) {
                Auth::login($user);
                return $next($request);
            }
        }

        $username = $request->header(CommonGvar::AuthUsername);
        $password = $request->header(CommonGvar::AuthPassword);

        if ($username && $password) {
            if (Auth::attempt(['username' => $username, 'password' => $password])) {
                return $next($request);
            }
        }
        $isDebug = ApiDebugTokenAuth::isDebugToken($request);
        if ($isDebug) {
            $userData = CommonUserGen::randomGenUsername();
            $user = $userData['user'];
            Auth::login($user);
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Unauthenticated. Please login first.',
            'code' => 'AUTH_REQUIRED'
        ], 401);
    }
}

