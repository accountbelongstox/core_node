<?php

namespace App\Http\Middleware;

use App\Services\ClientKey\ClientKeyAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alias `client.key_or_dashboard`: routes that operators and machines both
 * call. A request carrying a client-key signature is judged by K3 only;
 * any other request goes through `dashboard.auth` at the given level.
 */
class ClientKeyOrDashboard
{
    public function __construct(private readonly LocalDebugOrSanctum $dashboard)
    {
    }

    public function handle(Request $request, Closure $next, string $level = LocalDebugOrSanctum::LEVEL_ADMIN): Response
    {
        $errorCode = null;

        if (!ClientKeyAuthService::hasSignature($request)) {
            return $this->dashboard->handle($request, $next, $level);
        }
        $errorCode = ClientKeyAuthService::verify($request);
        if ($errorCode !== null) {
            return ClientKeyAuthService::errorResponse($errorCode);
        }

        return $next($request);
    }
}
