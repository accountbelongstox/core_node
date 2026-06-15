<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


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
        $isLaravelDebugMode = env('APP_DEBUG');
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