<?php

namespace App\Http\Middleware;

use App\Services\ClientKey\ClientKeyAuthService;
use App\Services\QueueCenter\QueueCenterCacheStore;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Alias `idempotent`: a write that carries an `Idempotency-Key` runs once per
 * caller, method, path and key. A replay after completion gets the stored
 * response (header `Idempotent-Replayed: true`); a replay while the first
 * run is still going gets 409. Requests without the header are unchanged.
 * Register it after the route's auth middleware so the caller is known.
 */
class IdempotentRequest
{
    public const HEADER = 'Idempotency-Key';
    private const REPLAYED_HEADER = 'Idempotent-Replayed';
    private const RESULT_PREFIX = 'idempotency:result:v1:';
    private const RUNNING_PREFIX = 'idempotency:running:v1:';
    private const RESULT_SECONDS = 86400;
    private const RUNNING_SECONDS = 3900;
    private const HTTP_CONFLICT = 409;
    /** Deterministic client errors a replay would get again; transient ones (409, 423, 429) are not stored. */
    private const STORED_CLIENT_ERRORS = [400, 404, 410, 422];

    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header(self::HEADER, ''));
        $cache = QueueCenterCacheStore::get();
        $scope = '';
        $stored = null;
        $response = null;

        if ($key === '' || $request->isMethodSafe()) {
            return $next($request);
        }
        $scope = hash('sha256', implode("\0", [
            $this->caller($request),
            $request->getMethod(),
            $request->path(),
            $key,
        ]));
        $stored = $cache->get(self::RESULT_PREFIX.$scope);
        if (is_array($stored)) {
            return response((string) ($stored['body'] ?? ''), (int) ($stored['status'] ?? 200), [
                'Content-Type' => (string) ($stored['content_type'] ?? 'application/json'),
                self::REPLAYED_HEADER => 'true',
            ]);
        }
        if (!$cache->add(self::RUNNING_PREFIX.$scope, true, self::RUNNING_SECONDS)) {
            return response()->json([
                'success' => false,
                'message' => __('idempotency.in_progress'),
                'code' => 'IDEMPOTENCY_IN_PROGRESS',
            ], self::HTTP_CONFLICT);
        }

        try {
            $response = $next($request);
            if (($response->isSuccessful() || in_array($response->getStatusCode(), self::STORED_CLIENT_ERRORS, true))
                && !$response instanceof BinaryFileResponse
                && !$response instanceof StreamedResponse) {
                $cache->put(self::RESULT_PREFIX.$scope, [
                    'status' => $response->getStatusCode(),
                    'content_type' => (string) $response->headers->get('Content-Type', 'application/json'),
                    'body' => (string) $response->getContent(),
                ], self::RESULT_SECONDS);
            }
        } finally {
            $cache->forget(self::RUNNING_PREFIX.$scope);
        }

        return $response;
    }

    private function caller(Request $request): string
    {
        $user = $request->user();
        $machineId = $request->attributes->get(ClientKeyAuthService::ATTRIBUTE_MACHINE_ID);

        if ($user !== null) {
            return 'user:'.$user->getAuthIdentifier();
        }
        if (is_string($machineId) && $machineId !== '') {
            return 'machine:'.$machineId;
        }

        return 'ip:'.$request->ip();
    }
}
