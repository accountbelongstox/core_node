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


namespace App\Apps\AppQyV1\AppQyV1Middleware\AppQyV1ClientAuth;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class AppQyV1ResourceAccessAuth
{
    /**
     * Handle an incoming request for static resource access.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        if ($this->isStaticResourceAccessValid($request)) {
            return $next($request);
        }

        return response()->json([
            'error' => 'Unauthorized',
            'message' => 'Invalid static resource access token'
        ], 401);
    }

    /**
     * Check if static resource access is valid (debug mode or resource key)
     */
    private function isStaticResourceAccessValid(Request $request): bool
    {
        $isDebugMode = env('APP_DEBUG', false);

        if ($isDebugMode) {
            return $this->isDebugToken($request);
        } else {
            return $this->isResourceAccessKeyValid($request);
        }
    }

    /**
     * Check debug token for development mode
     */
    public static function isDebugToken(Request $request): bool
    {
        $isLaravelDebugMode = env('APP_DEBUG');
        if (!$isLaravelDebugMode) {
            return false;
        }

        $token = $request->header('Auth-Debug-Token');
        if (!$token) {
            return false;
        }

        $validTokens = Config::get('auth.debug_tokens', []);
        if (!in_array($token, $validTokens)) {
            return false;
        }

        return true;
    }

    /**
     * Check resource access key for production mode (static resources like audio/images)
     */
    private function isResourceAccessKeyValid(Request $request): bool
    {
        $resourceKey = $request->header('Resource-Access-Key');
        if (!$resourceKey) {
            return false;
        }

        $validResourceKeys = Config::get('auth.resource_access_keys', []);
        if (!in_array($resourceKey, $validResourceKeys)) {
            return false;
        }

        return true;
    }
} 
