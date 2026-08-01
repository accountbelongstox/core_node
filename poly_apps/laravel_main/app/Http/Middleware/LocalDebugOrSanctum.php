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
 * - Bearer / Sanctum token present: always bind that user (even on loopback).
 *   Otherwise redeem/profile would mutate the highest-privilege DB row while the
 *   UI still shows the token account at rolelevel 0.
 * - Loopback (debug bypass enabled) and no token: resolve an admin user, bind it,
 *   and pass through with NO token required -> dashboard is login-free locally.
 * - Otherwise: enforce Sanctum, returning the standard 401 envelope when
 *   no valid bearer token is present.
 *
 * Alias: `dashboard.auth` (registered in bootstrap/app.php). Replaces a bare
 * `auth:sanctum` on dashboard API route groups.
 */
class LocalDebugOrSanctum
{
    public function handle(Request $request, Closure $next): Response
    {
        $sanctumUser = auth('sanctum')->user();
        if ($sanctumUser !== null) {
            auth()->setUser($sanctumUser);
            $request->setUserResolver(static fn () => $sanctumUser);

            return $next($request);
        }

        if (DebugAuthService::isDebugBypass($request)) {
            $user = DebugAuthService::resolveDebugUser();
            if ($user !== null) {
                auth()->setUser($user);
                $request->setUserResolver(static fn () => $user);
            }

            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Unauthenticated. Please login first.',
            'code' => 'AUTH_REQUIRED',
            'error' => 'Unauthenticated',
        ], 401);
    }
}
