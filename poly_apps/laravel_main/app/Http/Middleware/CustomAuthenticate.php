<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
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
                // Sanctum authenticated the token on its own guard, but the
                // default (web) guard stays empty, so $request->user() /
                // AuthHelper::requireAuth() would return null and controllers
                // would 401 a logged-in user. Propagate the identity to the
                // default guard, mirroring the user_token / debug branches.
                $sanctumUser = Auth::guard('sanctum')->user();
                if ($sanctumUser) {
                    Auth::login($sanctumUser);
                    $request->setUserResolver(function () use ($sanctumUser) {
                        return $sanctumUser;
                    });
                }
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

        // PddToolV1 (订多多) ROOT-level SaaS surface must emit the FastAPI
        // {"detail":"Could not validate credentials"} shape the Chrome extension
        // reads, instead of the generic {success:false} envelope below.
        $pddPaths = [
            'login', 'register', 'users/me', 'users/me/*',
            'batch-orders', 'batch-orders/*', 'convert-order-link',
            'recharge', 'recharge/*', 'pay/*', 'erp/*', 'pdd/health',
        ];
        if ($request->is(...$pddPaths)) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        return response()->json([
            'success' => false,
            'message' => 'Unauthenticated. Please login first.',
            'code' => 'AUTH_REQUIRED'
        ], 401);
    }
}

