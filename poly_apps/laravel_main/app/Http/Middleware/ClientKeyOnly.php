<?php

namespace App\Http\Middleware;

use App\Services\ClientKey\ClientKeyAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alias `client.key`: machine routes that require a valid shared client-key
 * signature (K3). Machine callers never fall back to web login.
 */
class ClientKeyOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $errorCode = ClientKeyAuthService::verify($request);

        if ($errorCode !== null) {
            return ClientKeyAuthService::errorResponse($errorCode);
        }

        return $next($request);
    }
}
