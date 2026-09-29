<?php

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
            'error' => __('app_qy_v1.messages.unauthorized'),
            'message' => __('app_qy_v1.messages.invalid_static_resource_access_token')
        ], 401);
    }

    /**
     * Check if static resource access is valid (debug mode or resource key)
     */
    private function isStaticResourceAccessValid(Request $request): bool
    {
        $isDebugMode = (bool) config('app.debug');

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
        $isLaravelDebugMode = (bool) config('app.debug');
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
