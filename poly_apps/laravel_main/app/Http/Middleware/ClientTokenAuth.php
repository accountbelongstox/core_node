<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class ClientTokenAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('Client-Token') ?? $request->input('client_token');
        
        // Get valid client tokens from config
        $validTokens = Config::get('auth.client_tokens', []);
        
        if (!$token || !in_array($token, $validTokens)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid or missing client token'
            ], 401);
        }
        
        return $next($request);
    }
} 