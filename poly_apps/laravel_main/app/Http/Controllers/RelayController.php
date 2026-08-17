<?php

namespace App\Http\Controllers;

use App\Http\Middleware\PycoreClientOnly;
use App\Services\Dashboard\DebugAuthService;
use App\Services\Relay\RelayBlobStore;
use App\Services\Relay\RelayCapabilityRegistry;
use App\Services\Relay\RelayDispatcher;
use App\Services\Relay\RelayHubAuthService;
use App\Services\Relay\RelayMachineRegistry;
use App\Services\Relay\RelayPairRegistry;
use App\Services\Relay\RelayRequestStore;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Relay controller: the 12 contract endpoints under /api/relay/*.
 *
 * Machine-side reads/writes run behind PycoreClientOnly; session-side calls
 * resolve a UI identity (Sanctum user or loopback debug) once per request.
 * The data plane is store-and-fetch; the control plane is one Mercure wake
 * update per transition. NO try-catch - trust data structures (trait rule).
 */
class RelayController extends Controller
{
    use ApiResponse;

    private const WAIT_STEP_SECONDS = 250000;
    private const WAIT_MAX_SECONDS = 25;

    public function machines(): JsonResponse
    {
        return $this->success([
            'machines' => RelayMachineRegistry::listOnline(),
            'capability_providers' => RelayCapabilityRegistry::providers(),
            'heartbeat_seconds' => RelayMachineRegistry::heartbeatSeconds(),
        ]);
    }

    public function registerMachine(Request $request): JsonResponse
    {
        $machineId = (string) $request->json('machine_id', '');
        if (!RelayMachineRegistry::isValidId($machineId)) {
            return $this->validationError(['machine_id' => ['Invalid machine id.']]);
        }

        $record = RelayMachineRegistry::register($machineId, [
            'label' => (string) $request->json('label', $machineId),
            'capabilities' => is_array($request->json('capabilities')) ? $request->json('capabilities') : [],
            'hostname' => (string) $request->json('hostname', ''),
            'platform' => (string) $request->json('platform', ''),
        ]);
        RelayDispatcher::announceRoster($machineId, true, $record);

        return $this->created([
            'machine' => $record,
            'heartbeat_seconds' => RelayMachineRegistry::heartbeatSeconds(),
            'hub' => RelayHubAuthService::issueForMachine($machineId),
        ]);
    }

    public function heartbeatMachine(Request $request): JsonResponse
    {
        $machineId = (string) $request->json('machine_id', '');
        if (!RelayMachineRegistry::isValidId($machineId)) {
            return $this->validationError(['machine_id' => ['Invalid machine id.']]);
        }
        if (!RelayMachineRegistry::heartbeat($machineId)) {
            return $this->conflict('Machine is not registered.', ['machine_id' => $machineId]);
        }

        return $this->success([
            'machine_id' => $machineId,
            'heartbeat_seconds' => RelayMachineRegistry::heartbeatSeconds(),
        ]);
    }

    public function unregisterMachine(Request $request): JsonResponse
    {
        $machineId = (string) $request->json('machine_id', '');
        if (RelayMachineRegistry::isValidId($machineId) && RelayMachineRegistry::isOnline($machineId)) {
            RelayMachineRegistry::unregister($machineId);
            RelayPairRegistry::release($machineId);
            RelayDispatcher::announceRoster($machineId, false);
        }

        return $this->success(['machine_id' => $machineId]);
    }

    public function hubAuth(Request $request): JsonResponse
    {
        $mode = (string) $request->json('mode', 'session');
        $token = null;

        if ($mode === 'machine') {
            $machineId = (string) $request->json('machine_id', '');
            if (!RelayMachineRegistry::isValidId($machineId) || !RelayMachineRegistry::isOnline($machineId)) {
                return $this->conflict('Machine is not online.', ['machine_id' => $machineId]);
            }
            $token = RelayHubAuthService::issueForMachine($machineId);
            return $this->success($token);
        }

        $session = self::resolveSession($request);
        $token = RelayHubAuthService::issueForSession(
            $request->filled('machine_id') ? (string) $request->json('machine_id') : null,
            $session['id']
        );

        return $this->success($token)->cookie(
            new Cookie(
                $token['cookie'],
                $token['token'],
                now()->addSeconds($token['token_ttl_seconds'])->timestamp,
                parse_url($token['hub_url'], PHP_URL_PATH) ?: '/.well-known/mercure',
                null,
                true,
                true,
                false,
                'strict'
            )
        );
    }

    public function pair(Request $request, string $machineId): JsonResponse
    {
        if (!RelayMachineRegistry::isValidId($machineId) || !RelayMachineRegistry::isOnline($machineId)) {
            return $this->conflict('peer-offline', ['machine_id' => $machineId]);
        }

        $session = self::resolveSession($request);
        $record = RelayPairRegistry::pair($machineId, $session['id']);

        return $this->success([
            'pair' => $record,
            'hub' => RelayHubAuthService::issueForSession($machineId),
        ]);
    }

    public function createRequest(Request $request, string $machineId): JsonResponse
    {
        $session = self::resolveSession($request);
        if (!RelayDispatcher::gate($machineId, RelayPairRegistry::sessionFor($machineId))) {
            return $this->conflict('peer-offline', ['machine_id' => $machineId]);
        }

        $method = strtoupper((string) $request->json('method', 'GET'));
        $path = (string) $request->json('path', '');
        if ($path === '' || $path[0] !== '/') {
            return $this->validationError(['path' => ['Path must be an absolute pycore route.']]);
        }

        $inlineCap = \App\Support\QueueCenterContract::relayCap('inline_body_bytes');
        $body = $request->json('body');
        $bodyRef = (string) ($request->json('body_ref') ?? '');
        if (is_string($body) && strlen($body) > $inlineCap) {
            return $this->validationError(['body' => ['Inline body exceeds cap; upload a blob first.']]);
        }
        if ($bodyRef !== '' && RelayBlobStore::meta($machineId, $bodyRef) === null) {
            return $this->validationError(['body_ref' => ['Unknown or expired blob.']]);
        }

        $requestId = RelayRequestStore::newRequestId();
        $frame = [
            'request_id' => $requestId,
            'method' => $method,
            'path' => $path,
            'size' => is_string($body) ? strlen($body) : 0,
        ];
        RelayRequestStore::putRequest($machineId, $requestId, [
            'request_id' => $requestId,
            'session_id' => $session['id'],
            'method' => $method,
            'path' => $path,
            'headers' => is_array($request->json('headers')) ? $request->json('headers') : [],
            'body' => is_string($body) ? $body : null,
            'body_ref' => $bodyRef !== '' ? $bodyRef : null,
        ]);
        RelayDispatcher::dispatchRequest($machineId, $frame);
        RelayPairRegistry::refresh($machineId, (string) RelayPairRegistry::sessionFor($machineId));

        return $this->created(['request' => $frame, 'poll_interval_ms' => \App\Support\QueueCenterContract::relayInt('response_poll_interval_ms')]);
    }

    public function fetchRequest(string $machineId, string $requestId): JsonResponse
    {
        $stored = RelayRequestStore::getRequest($machineId, $requestId);
        if ($stored === null) {
            return $this->notFound('Request expired or unknown.');
        }

        return $this->success(['request' => $stored]);
    }

    public function createResponse(Request $request, string $machineId): JsonResponse
    {
        $requestId = (string) $request->json('request_id', '');
        if (RelayRequestStore::getRequest($machineId, $requestId) === null) {
            return $this->notFound('Request expired or unknown.');
        }

        $inlineCap = \App\Support\QueueCenterContract::relayCap('inline_body_bytes');
        $body = $request->json('body');
        $bodyRef = (string) ($request->json('body_ref') ?? '');
        if (is_string($body) && strlen($body) > $inlineCap) {
            return $this->validationError(['body' => ['Inline body exceeds cap; upload a blob first.']]);
        }

        $status = (int) $request->json('status', 200);
        RelayRequestStore::putResponse($machineId, $requestId, [
            'request_id' => $requestId,
            'status' => $status,
            'headers' => is_array($request->json('headers')) ? $request->json('headers') : [],
            'body' => is_string($body) ? $body : null,
            'body_ref' => $bodyRef !== '' ? $bodyRef : null,
        ]);
        RelayDispatcher::dispatchResponse($machineId, [
            'request_id' => $requestId,
            'status' => $status,
            'size' => is_string($body) ? strlen($body) : 0,
        ]);

        return $this->created(['request_id' => $requestId]);
    }

    public function fetchResponse(Request $request, string $machineId, string $requestId): JsonResponse
    {
        $deadline = time() + self::WAIT_MAX_SECONDS;
        $response = null;
        $wait = $request->boolean('wait');

        while (true) {
            $response = RelayRequestStore::getResponse($machineId, $requestId);
            if ($response !== null || !$wait || time() >= $deadline) {
                break;
            }
            usleep(self::WAIT_STEP_SECONDS);
        }

        if ($response === null) {
            return $this->notFound('Response not ready.');
        }

        return $this->success(['response' => $response]);
    }

    public function createBlob(Request $request, string $machineId): JsonResponse
    {
        $blobId = (string) $request->query('blob_id', '');
        $chunkIndex = (int) $request->query('chunk_index', 0);
        $last = $request->boolean('chunk_last');
        $bytes = (string) $request->getContent();

        $meta = RelayBlobStore::create(
            $machineId,
            $blobId !== '' ? $blobId : null,
            $chunkIndex,
            $last,
            $bytes
        );

        return $this->created(['blob' => $meta]);
    }

    public function fetchBlob(string $machineId, string $blobId): Response
    {
        $bytes = RelayBlobStore::read($machineId, $blobId);
        if ($bytes === null) {
            return response('Blob incomplete, unknown, or expired.', 404, ['Content-Type' => 'text/plain']);
        }

        return response($bytes, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * UI identity: Sanctum user first, loopback debug second. Machine calls
     * never reach here (PycoreClientOnly group resolves machine identity in
     * its middleware contract).
     */
    private static function resolveSession(Request $request): array
    {
        $user = $request->user();
        if ($user !== null) {
            return ['kind' => 'user', 'id' => 'user:'.(string) $user->getAuthIdentifier()];
        }
        if (DebugAuthService::isLoopback($request)) {
            return ['kind' => 'debug', 'id' => 'debug:'.(string) $request->ip()];
        }

        return ['kind' => 'anonymous', 'id' => 'anonymous:'.(string) $request->ip()];
    }
}
