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
    private const SERVICE_HEADER = 'X-Core-Node-Service';
    private const SERVICE_ID = 'laravel_main';

    /**
     * Recognized machine identity: pycore header pair or loopback debug.
     * Shared with dual-identity endpoints (relay blob reads) so the same
     * recognition logic has one definition site.
     */
    public static function isMachineCall(Request $request): bool
    {
        $clientId = (string) $request->header(self::CLIENT_HEADER, '');
        $protocolVersion = (string) $request->header(self::PROTOCOL_HEADER, '');

        return DebugAuthService::isLoopback($request)
            || (hash_equals(self::CLIENT_ID, $clientId)
                && hash_equals(self::PROTOCOL_VERSION, $protocolVersion));
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
