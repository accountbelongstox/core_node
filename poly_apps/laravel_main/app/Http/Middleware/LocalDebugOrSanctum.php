<?php

namespace App\Http\Middleware;

use App\Http\EnvironmentApiInfo\DashboardAuthController;
use App\Models\User;
use App\Services\Dashboard\DebugAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dashboard auth gate: allow EITHER a same-machine loopback debug session OR a
 * valid Sanctum token whose user holds the required role level.
 *
 * - Bearer / Sanctum token present: always bind that user (even on loopback)
 *   and require the level: `admin` (default), `super_admin`, or `user`
 *   (any account, for self-service routes).
 * - Loopback (debug bypass enabled) and no token: resolve an admin user, bind it,
 *   and pass through with NO token required -> dashboard is login-free locally.
 * - Otherwise: 401 without a token, 403 when the account lacks the level.
 *
 * Alias: `dashboard.auth` (registered in bootstrap/app.php), used as
 * `dashboard.auth`, `dashboard.auth:super_admin` or `dashboard.auth:user`.
 * routes/web.php is immutable, so its self-service actions are listed here.
 */
class LocalDebugOrSanctum
{
    public const LEVEL_USER = 'user';
    public const LEVEL_ADMIN = 'admin';
    public const LEVEL_SUPER_ADMIN = 'super_admin';

    private const SELF_SERVICE_ACTIONS = [
        DashboardAuthController::class.'@elevate',
        DashboardAuthController::class.'@updateProfile',
        DashboardAuthController::class.'@logout',
    ];

    public function handle(Request $request, Closure $next, string $level = self::LEVEL_ADMIN): Response
    {
        $sanctumUser = auth('sanctum')->user();
        $requiredLevel = $this->requiredLevel($request, $level);

        if ($sanctumUser !== null) {
            if (!$this->meetsLevel($sanctumUser, $requiredLevel)) {
                return response()->json([
                    'success' => false,
                    'message' => __('dashboard_auth.'.$requiredLevel.'_required'),
                    'code' => 'AUTH_FORBIDDEN',
                    'error' => 'Forbidden',
                ], 403);
            }
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
            'message' => __('dashboard_auth.login_required'),
            'code' => 'AUTH_REQUIRED',
            'error' => 'Unauthenticated',
        ], 401);
    }

    private function requiredLevel(Request $request, string $level): string
    {
        $action = (string) ($request->route()?->getActionName() ?? '');

        if (in_array($action, self::SELF_SERVICE_ACTIONS, true)) {
            return self::LEVEL_USER;
        }

        return in_array($level, [self::LEVEL_USER, self::LEVEL_ADMIN, self::LEVEL_SUPER_ADMIN], true)
            ? $level
            : self::LEVEL_ADMIN;
    }

    private function meetsLevel(mixed $user, string $level): bool
    {
        return match ($level) {
            self::LEVEL_USER => true,
            self::LEVEL_SUPER_ADMIN => $user instanceof User && $user->isSuperAdmin(),
            default => $user instanceof User && $user->isAdmin(),
        };
    }
}
