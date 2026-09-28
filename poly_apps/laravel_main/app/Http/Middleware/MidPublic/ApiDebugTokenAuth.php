<?php

namespace App\Http\Middleware\MidPublic;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class ApiDebugTokenAuth 
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public static function isDebugToken(Request $request)
    {
        $isLaravelDebugMode = (bool) config('app.debug');
        if(!$isLaravelDebugMode){
            return false;
        }
        $token = $request->header('Auth-Debug-Token');
        if(!$token){
            return false;
        }
        $validTokens = Config::get('auth.debug_tokens', []);
        if(!in_array($token, $validTokens)){
            return false;
        }
        return true;
    }
} 
