<?php

namespace App\CallPycoreUtils;

use App\Support\ServiceContract;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HTTP client for pycore's rpc_v2 server.
 *
 * Protocol (pycore/pyutils/rpc_v2/server.py):
 * - POST {BASE_URL}/api/{route} with a flat JSON object body; the body keys
 *   are the handler parameters (no request envelope).
 * - Success: HTTP 200 with the handler's return value as the JSON body
 *   (no response envelope; 204 when the handler returns null).
 * - Failure: HTTP 4xx/5xx with
 *   {"success": false, "error": {"code": ..., "message": ...}, "route": ..., "request_id": ...}.
 * - Handler-level failures return HTTP 200 with {"success": false, "error": ...}.
 * - rpc_v2 is fully synchronous; there is no async polling equivalent.
 */
class PycoreHttpClient
{
    /**
     * Route prefix exposed by the rpc_v2 server
     * (HTTP_API_PREFIX in pycore/pyfoundations/network_constants.py).
     */
    private const API_PREFIX = '/api';

    private const DEFAULT_TIMEOUT = 60;

    /**
     * Call an rpc_v2 route (slash-separated, e.g. 'translator/translate_single').
     *
     * Returns ['success' => true, 'result' => <handler payload>] on success,
     * or ['error' => <message>, ...] on transport/protocol/handler failure.
     */
    public static function call(
        string $route,
        array $params = [],
        int $timeout = self::DEFAULT_TIMEOUT
    ): array {
        $path = self::API_PREFIX . '/' . ltrim($route, '/');

        try {
            $response = Http::timeout($timeout)
                ->post(ServiceContract::pycoreBackendUrl().$path, $params);

            $payload = $response->json();

            if (!$response->successful()) {
                $message = is_array($payload)
                    ? ($payload['error']['message'] ?? $response->body())
                    : $response->body();

                Log::error('[PycoreHttpClient] rpc_v2 call failed', [
                    'route' => $route,
                    'status' => $response->status(),
                    'error' => $message,
                ]);

                return [
                    'error' => $message,
                    'status' => $response->status(),
                    'details' => $payload,
                ];
            }

            if (!is_array($payload)) {
                return [
                    'success' => true,
                    'result' => $payload,
                ];
            }

            if (($payload['success'] ?? true) === false) {
                $error = $payload['error'] ?? 'Unknown pycore error';

                Log::error('[PycoreHttpClient] rpc_v2 handler error', [
                    'route' => $route,
                    'error' => $error,
                ]);

                return [
                    'error' => is_string($error) ? $error : json_encode($error),
                    'details' => $payload,
                ];
            }

            return [
                'success' => true,
                'result' => $payload,
            ];

        } catch (\Exception $e) {
            Log::error('[PycoreHttpClient] Exception', [
                'route' => $route,
                'error' => $e->getMessage(),
            ]);

            return [
                'error' => 'HTTP request failed',
                'message' => $e->getMessage(),
            ];
        }
    }
}
