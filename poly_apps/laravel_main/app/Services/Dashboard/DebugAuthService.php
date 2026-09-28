<?php

namespace App\Services\Dashboard;

use App\Models\User;
use App\Providers\PathMapper;
use App\Support\RuntimeConfigurationStore;
use Illuminate\Http\Request;

/**
 * Local-debug authentication helper for the dashboard.
 *
 * Design (the "better approach" reusing the repo's existing LocalAccessOnly
 * loopback detection): when the dashboard frontend and the Laravel backend run on
 * the SAME machine, the API request arrives from a loopback address (127.0.0.1 /
 * ::1 / localhost). In that case we treat the session as a trusted local debug
 * session and BYPASS login -- the dashboard becomes login-free. Remote (non-local)
 * requests always fall back to the normal Sanctum token guard.
 *
 * The global-var store key DASHBOARD_LOCAL_DEBUG switches the bypass. When it is
 * unset, the bypass is on for development hosts (Windows, WSL, desktop session)
 * and off for production hosts, where loopback callers must log in too.
 */
class DebugAuthService
{
    /** Loopback client IPs that identify a same-machine request. */
    private const LOOPBACK = ['127.0.0.1', '::1'];

    /**
     * True when the request originates from the local machine (loopback). Mirrors
     * App\Http\Middleware\LocalAccessOnly so the two stay consistent.
     *
     * Trust is derived from the resolved client IP ONLY. The previous
     * getHost()=='localhost' branch is removed: Host is an attacker-controllable
     * header, so a remote request with `Host: localhost` must NOT pass. With the
     * loopback proxy trusted (bootstrap/app.php trustProxies), $request->ip()
     * reflects the genuine client even behind nginx.
     */
    public static function isLoopback(Request $request): bool
    {
        $clientIp = (string) $request->ip();

        return in_array($clientIp, self::LOOPBACK, true);
    }

    /**
     * Whether the loopback debug bypass is enabled: the global-var
     * DASHBOARD_LOCAL_DEBUG when set, else on only for development hosts.
     */
    public static function debugEnabled(): bool
    {
        $default = PathMapper::isWindows() || !PathMapper::isProduction() ? 'true' : 'false';
        $flag = strtolower((string) RuntimeConfigurationStore::get('DASHBOARD_LOCAL_DEBUG', $default));

        return !in_array($flag, ['false', '0', 'off', 'no', ''], true);
    }

    /** True when this request should skip login (loopback + enabled). */
    public static function isDebugBypass(Request $request): bool
    {
        return self::debugEnabled() && self::isLoopback($request);
    }

    /**
     * Resolve the user to act as during a debug bypass: the highest-privilege
     * account (admin) if any exist, else any user, else null. Null is acceptable --
     * the bypass still grants access; controllers must tolerate a null user.
     */
    public static function resolveDebugUser(): ?User
    {
        try {
            return User::highestRoleUser();
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Public status payload (consumed by the frontend to decide whether to show the
     * login gate). No secrets are exposed -- only whether login is required here.
     */
    public static function status(Request $request): array
    {
        $loopback = self::isLoopback($request);
        $enabled = self::debugEnabled();
        $debug = $loopback && $enabled;

        return [
            'debug_mode' => $debug,
            'login_required' => !$debug,
            'reason' => $debug ? 'loopback' : ($loopback ? 'disabled' : 'remote'),
            'client_ip' => (string) $request->ip(),
        ];
    }
}
