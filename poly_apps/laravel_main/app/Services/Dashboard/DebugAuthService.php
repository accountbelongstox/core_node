<?php

namespace App\Services\Dashboard;

use App\Models\User;
use App\Support\CoreNodeSecrets;
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
 * The bypass can be disabled (e.g. on a shared host where localhost is not trusted)
 * by writing `false` into the global-var store key DASHBOARD_LOCAL_DEBUG; it is
 * enabled by default so same-machine development is friction-free.
 */
class DebugAuthService
{
    /** Loopback hosts that identify a same-machine request. */
    private const LOOPBACK = ['localhost', '127.0.0.1', '::1'];

    /**
     * True when the request originates from the local machine (loopback). Mirrors
     * App\Http\Middleware\LocalAccessOnly so the two stay consistent.
     */
    public static function isLoopback(Request $request): bool
    {
        $clientIp = (string) $request->ip();
        $host = (string) $request->getHost();

        return in_array($clientIp, self::LOOPBACK, true)
            || in_array($host, self::LOOPBACK, true);
    }

    /**
     * Whether the loopback debug bypass is enabled. Enabled unless the global-var
     * DASHBOARD_LOCAL_DEBUG is explicitly set to a falsey value.
     */
    public static function debugEnabled(): bool
    {
        $flag = strtolower((string) CoreNodeSecrets::get('DASHBOARD_LOCAL_DEBUG', 'true'));

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
            return User::query()->orderByDesc('rolelevel')->orderBy('id')->first();
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
