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