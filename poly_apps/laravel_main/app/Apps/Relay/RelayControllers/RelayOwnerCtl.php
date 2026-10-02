<?php

namespace App\Apps\Relay\RelayControllers;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayServices\RelayBlobService;
use App\Apps\Relay\RelayServices\RelayContract;
use App\Apps\Relay\RelayServices\RelayEnrollmentService;
use App\Apps\Relay\RelayServices\RelayFrameService;
use App\Apps\Relay\RelayServices\RelayOwnerResolver;
use App\Apps\Relay\RelayServices\RelayPairingService;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class RelayOwnerCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly RelayOwnerResolver $owners,
        private readonly RelayEnrollmentService $enrollments,
        private readonly RelayPairingService $pairings,
        private readonly RelayFrameService $frames,
        private readonly RelayBlobService $blobs
    ) {
    }

    public function claimEnrollment(Request $request): JsonResponse
    {
        $validated = $request->validate(['claim_code' => ['required', 'string', 'max:16']]);
        $user = $this->user($request);

        return $this->success(
            $this->enrollments->claim((int) $user->getAuthIdentifier(), (string) $validated['claim_code']),
            __('relay.success')
        );
    }

    public function roster(Request $request): JsonResponse
    {
        $user = $this->user($request);
        if ($user->isAdmin()) {
            try {
                $this->enrollments->autoClaimPending((int) $user->getAuthIdentifier());
            } catch (Throwable $exception) {
                Log::warning('[Relay] Pending enrollment auto-claim failed', [
                    'user_id' => (int) $user->getAuthIdentifier(),
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $this->success($this->pairings->roster((int) $user->getAuthIdentifier()), __('relay.success'));
    }

    public function createPairing(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'client_instance_id' => ['required', 'string', 'min:16', 'max:255'],
        ]);
        $user = $this->user($request);

        return $this->success($this->pairings->create(
            (int) $user->getAuthIdentifier(),
            (string) $validated['device_id'],
            (string) $validated['client_instance_id']
        ), __('relay.success'));
    }

    public function renewPairing(Request $request, string $pairingId): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->pairings->renew((int) $user->getAuthIdentifier(), $pairingId),
            __('relay.success')
        );
    }

    public function revokePairing(Request $request, string $pairingId): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->pairings->revoke((int) $user->getAuthIdentifier(), $pairingId),
            __('relay.success')
        );
    }

    public function grant(Request $request): JsonResponse
    {
        $validated = $request->validate(['contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/']]);
        $startedAt = microtime(true);

        return $this->timed($this->success(
            $this->frames->ownerGrant($this->user($request), (string) $validated['contract_digest']),
            __('relay.success')
        ), $startedAt);
    }

    public function frames(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'operation_id' => ['required', 'uuid'],
            'pairing_id' => ['required', 'uuid'],
            'method' => ['required', 'string', 'max:16'],
            'path' => ['required', 'string', 'max:4096'],
            'query' => ['present', 'array'],
            'headers' => ['present', 'array'],
            'body' => ['required', 'array'],
            'body.present' => ['required', 'boolean'],
            'body.length' => ['required', 'integer', 'min:0'],
            'body.sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'body.base64' => ['nullable', 'string'],
            'body.ref' => ['nullable', 'uuid'],
        ]);
        $startedAt = microtime(true);
        $user = $this->user($request);
        $result = $this->frames->admitFrame(
            $user,
            $validated,
            RelayOwnerResolver::rateKey($request) ?? 'user:'.$user->getAuthIdentifier()
        );

        return $this->timed($this->success($result['body'], __('relay.accepted'), (int) $result['status']), $startedAt);
    }

    public function telemetry(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'max:200'],
            'items.*.operation_id' => ['required', 'uuid'],
            'items.*.route_policy' => ['nullable', 'string', 'max:64'],
            'items.*.http_status' => ['nullable', 'integer', 'between:0,999'],
            'items.*.outcome' => ['nullable', 'string', 'max:32'],
            'items.*.t_ui_send' => ['nullable', 'integer', 'min:0'],
            'items.*.t_ui_recv' => ['nullable', 'integer', 'min:0'],
            'items.*.dev_recv' => ['nullable', 'integer', 'min:0'],
            'items.*.dev_send' => ['nullable', 'integer', 'min:0'],
            'items.*.exec_ms' => ['nullable', 'integer', 'min:0'],
            'items.*.bytes_in' => ['nullable', 'integer', 'min:0'],
            'items.*.bytes_out' => ['nullable', 'integer', 'min:0'],
        ]);
        $userId = (int) $this->user($request)->getAuthIdentifier();
        $items = array_map(static function (array $item): array {
            $item['t_dev_recv'] = $item['dev_recv'] ?? null;
            $item['t_dev_send'] = $item['dev_send'] ?? null;
            unset($item['dev_recv'], $item['dev_send']);

            return $item;
        }, $validated['items']);

        return $this->success(['accepted' => $this->frames->recordTelemetry($userId, $items)], __('relay.accepted'), 202);
    }

    public function stats(Request $request): JsonResponse
    {
        $minutes = (int) $request->query('minutes', RelayContract::duration('stats_window_default_minutes'));
        $userId = (int) $this->user($request)->getAuthIdentifier();

        return $this->success(['routes' => $this->frames->stats($userId, $minutes)], __('relay.success'));
    }

    public function allocateRequestBlob(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'blob_id' => ['required', 'uuid'],
            'pairing_id' => ['required', 'uuid'],
            'direction' => ['required', 'in:request'],
            'expected_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'expected_length' => ['required', 'integer', 'min:0'],
        ]);
        $user = $this->user($request);

        return $this->success(
            $this->blobs->allocateRequest((int) $user->getAuthIdentifier(), $validated),
            __('relay.success')
        );
    }

    public function requestBlobChunk(Request $request, string $blobId, string $chunkIndex): JsonResponse
    {
        $user = $this->user($request);
        $index = ctype_digit($chunkIndex) ? (int) $chunkIndex : -1;

        if ($index < 0) {
            throw new RelayDomainException('blob_chunk_index_invalid', 422);
        }

        return $this->success(
            $this->blobs->storeOwnerChunk((int) $user->getAuthIdentifier(), $blobId, $index, (string) $request->getContent()),
            __('relay.success')
        );
    }

    public function finalizeRequestBlob(Request $request, string $blobId): JsonResponse
    {
        $validated = $request->validate([
            'blob_id' => ['required', 'uuid'],
            'expected_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'expected_length' => ['required', 'integer', 'min:0'],
        ]);
        $user = $this->user($request);

        if (!hash_equals($blobId, (string) $validated['blob_id'])) {
            throw new RelayDomainException('blob_id_conflict', 409);
        }

        return $this->success(
            $this->blobs->finalizeOwner((int) $user->getAuthIdentifier(), $blobId, $validated),
            __('relay.success')
        );
    }

    public function responseBlob(Request $request, string $blobId): Response
    {
        $user = $this->user($request);
        $bytes = $this->blobs->readOwnerResponse((int) $user->getAuthIdentifier(), $blobId);

        return response($bytes, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function timed(JsonResponse $response, float $startedAt): JsonResponse
    {
        $response->headers->set('Server-Timing', sprintf('relay;dur=%.1f', (microtime(true) - $startedAt) * 1000));

        return $response;
    }

    private function user(Request $request): User
    {
        return $this->owners->resolve($request);
    }
}
