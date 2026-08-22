<?php

namespace App\Http\Middleware;

use App\Services\Relay\RelayDeviceIdentity;
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
     * Recognized machine identity: the pycore protocol headers plus the
     * request-bound device signature.
     * Shared with dual-identity endpoints (relay blob reads) so the same
     * recognition logic has one definition site.
     */
    public static function isMachineCall(Request $request): bool
    {
        return self::hasPycoreIdentity($request) && RelayDeviceIdentity::verify($request);
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
                'error' => __('relay.machine_identity_invalid'),
                'message' => __('relay.machine_identity_invalid'),
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
