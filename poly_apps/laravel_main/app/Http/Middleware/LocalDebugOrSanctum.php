<?php

namespace App\Http\Middleware;

use App\Services\Dashboard\DebugAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dashboard auth gate: allow EITHER a same-machine loopback debug session OR a
 * valid Sanctum token.
 *
 * - Loopback (debug bypass enabled): resolve an admin user, bind it to the request,
 *   and pass through with NO token required -> dashboard is login-free locally.
 * - Otherwise: enforce the Sanctum guard, returning the standard 401 envelope when
 *   no valid bearer token is present.
 *
 * Alias: `dashboard.auth` (registered in bootstrap/app.php). Replaces a bare
 * `auth:sanctum` on dashboard API route groups.
 */
class LocalDebugOrSanctum
{
    public function handle(Request $request, Closure $next): Response
    {
        if (DebugAuthService::isDebugBypass($request)) {
            $user = DebugAuthService::resolveDebugUser();
            if ($user !== null) {
                auth()->setUser($user);
                $request->setUserResolver(static fn () => $user);
            }

            return $next($request);
        }

        $user = auth('sanctum')->user();
        if ($user === null) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Please login first.',
                'code' => 'AUTH_REQUIRED',
                'error' => 'Unauthenticated',
            ], 401);
        }

        auth()->setUser($user);
        $request->setUserResolver(static fn () => $user);

        return $next($request);
    }
}
