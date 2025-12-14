<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Local Access Only Middleware
 * Only allows requests from localhost or 127.0.0.1
 */
class LocalAccessOnly
{
    /**
     * Handle an incoming request
     */
    public function handle(Request $request, Closure $next): Response
    {
        $allowedHosts = ['localhost', '127.0.0.1', '::1'];
        $clientIp = $request->ip();
        $serverName = $request->getHost();

        $isLocalIp = in_array($clientIp, $allowedHosts);
        $isLocalHost = in_array($serverName, $allowedHosts);

        if (!$isLocalIp && !$isLocalHost) {
            return response()->json([
                'success' => false,
                'error' => 'Access denied. This endpoint is only accessible from localhost.',
                'message' => 'Access denied. This endpoint is only accessible from localhost.',
                'code' => 403,
                'status' => 'error',
            ], 403);
        }

        return $next($request);
    }
}
