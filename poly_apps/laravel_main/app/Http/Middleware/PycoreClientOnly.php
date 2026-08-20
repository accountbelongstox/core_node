<?php

namespace App\Http\Middleware;

use App\Services\Dashboard\DebugAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PycoreClientOnly
{
    private const CLIENT_HEADER = 'X-Core-Node-Client';
    private const CLIENT_ID = 'pycore';
    private const PROTOCOL_HEADER = 'X-Core-Node-Protocol';
    private const PROTOCOL_VERSION = '1';
    private const SERVICE_ORIGIN_HEADER = 'X-Core-Node-Service-Origin';
    private const SERVICE_HEADER = 'X-Core-Node-Service';
    private const SERVICE_ID = 'laravel_main';

    /**
     * Recognized machine identity: pycore header pair or loopback debug.
     * Shared with dual-identity endpoints (relay blob reads) so the same
     * recognition logic has one definition site.
     */
    public static function isMachineCall(Request $request): bool
    {
        return DebugAuthService::isLoopback($request)
            || self::hasPycoreIdentity($request);
    }

    public static function serviceOrigin(Request $request): ?string
    {
        $origin = trim((string) $request->header(self::SERVICE_ORIGIN_HEADER, ''));
        $parts = [];
        $scheme = '';
        $host = '';
        $authority = '';
        $port = null;

        if ($origin === '' || !self::hasPycoreIdentity($request)) {
            return null;
        }

        $parts = parse_url($origin);
        if (!is_array($parts)) {
            return null;
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');
        $port = isset($parts['port']) ? (int) $parts['port'] : null;
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            return null;
        }
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['path'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            return null;
        }

        $authority = str_contains($host, ':') ? '['.$host.']' : $host;

        return $scheme.'://'.$authority.($port !== null ? ':'.$port : '');
    }

    private static function hasPycoreIdentity(Request $request): bool
    {
        $clientId = (string) $request->header(self::CLIENT_HEADER, '');
        $protocolVersion = (string) $request->header(self::PROTOCOL_HEADER, '');

        return hash_equals(self::CLIENT_ID, $clientId)
            && hash_equals(self::PROTOCOL_VERSION, $protocolVersion);
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (!self::isMachineCall($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Access denied. A recognized Pycore client is required.',
                'message' => 'Access denied. A recognized Pycore client is required.',
                'code' => 403,
                'status' => 'error',
            ], 403);
        }

        $response = $next($request);

        return $response
            ->header(self::SERVICE_HEADER, self::SERVICE_ID)
            ->header(self::PROTOCOL_HEADER, self::PROTOCOL_VERSION);
    }
}
