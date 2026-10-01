<?php

namespace App\Apps\Relay\RelayControllers;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayServices\RelayBlobService;
use App\Apps\Relay\RelayServices\RelayDeviceService;
use App\Apps\Relay\RelayServices\RelayEnrollmentService;
use App\Apps\Relay\RelayServices\RelayFrameService;
use App\Http\Controllers\Controller;
use App\Services\ClientKey\ClientKeyAuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

final class RelayDeviceCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly RelayEnrollmentService $enrollments,
        private readonly RelayDeviceService $devices,
        private readonly RelayFrameService $frames,
        private readonly RelayBlobService $blobs
    ) {
    }

    public function createEnrollment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device' => ['required', 'array'],
            'device.device_id' => ['required', 'uuid'],
            'device.label' => ['required', 'string', 'max:255'],
            'device.platform' => ['nullable', 'string', 'max:2000'],
            'device.public_key' => ['required', 'string', 'max:128'],
            'device.key_algorithm' => ['required', Rule::in(['ed25519'])],
            'device.key_version' => ['required', 'integer', 'min:1'],
            'device.contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'device.capability_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'device.capabilities' => ['required', 'array'],
            'device.capabilities.*' => ['string', 'max:128'],
        ]);

        $enrollment = $this->enrollments->create($validated['device']);
        if (ClientKeyAuthService::isMachineCall($request)) {
            $enrollment = $this->enrollments->approveWithClientKey($enrollment);
        }

        return $this->success($enrollment, __('relay.success'));
    }

    public function enrollmentStatus(Request $request, string $enrollment_id): JsonResponse
    {
        return $this->success(
            $this->enrollments->status($enrollment_id, $this->deviceId($request)),
            __('relay.success')
        );
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'online' => ['sometimes', 'boolean'],
            'contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'capabilities' => ['required', 'array'],
            'capabilities.*' => ['string', 'max:128'],
            'stream_connected' => ['required', 'boolean'],
            'active_requests' => ['sometimes', 'integer', 'min:0'],
            'grant_version' => ['nullable', 'string', 'max:32'],
        ]);
        $deviceId = $this->deviceId($request);

        $this->assertBodyDevice($deviceId, (string) $validated['device_id']);

        return $this->success($this->frames->deviceHeartbeat($deviceId, $validated), __('relay.success'));
    }

    public function event(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'event_type' => ['required', 'string', 'max:128'],
            'revision' => ['required', 'integer', 'min:1'],
            'payload' => ['present', 'array'],
        ]);
        $deviceId = $this->deviceId($request);

        $this->assertBodyDevice($deviceId, (string) $validated['device_id']);

        return $this->success($this->devices->event($deviceId, $validated), __('relay.success'));
    }

    public function requestBlob(Request $request, string $blob_id): Response
    {
        $bytes = $this->blobs->readDeviceRequest($this->deviceId($request), $blob_id);

        return response($bytes, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function allocateResponseBlob(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'blob_id' => ['required', 'uuid'],
            'operation_id' => ['required', 'uuid'],
            'pairing_id' => ['required', 'uuid'],
            'direction' => ['required', Rule::in(['response'])],
            'expected_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'expected_length' => ['required', 'integer', 'min:0'],
        ]);

        return $this->success(
            $this->blobs->allocateResponse($this->deviceId($request), $validated),
            __('relay.success')
        );
    }

    public function responseBlobChunk(Request $request, string $blob_id, string $chunk_index): JsonResponse
    {
        $chunkIndex = ctype_digit($chunk_index) ? (int) $chunk_index : -1;

        if ($chunkIndex < 0) {
            throw new RelayDomainException('blob_chunk_index_invalid', 422);
        }

        return $this->success(
            $this->blobs->storeDeviceChunk(
                $this->deviceId($request),
                $blob_id,
                $chunkIndex,
                (string) $request->getContent()
            ),
            __('relay.success')
        );
    }

    public function finalizeResponseBlob(Request $request, string $blob_id): JsonResponse
    {
        $validated = $request->validate([
            'blob_id' => ['required', 'uuid'],
            'expected_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'expected_length' => ['required', 'integer', 'min:0'],
        ]);

        if (!hash_equals($blob_id, (string) $validated['blob_id'])) {
            throw new RelayDomainException('blob_id_conflict', 409);
        }

        return $this->success(
            $this->blobs->finalizeDevice($this->deviceId($request), $blob_id, $validated),
            __('relay.success')
        );
    }

    private function deviceId(Request $request): string
    {
        $deviceId = (string) $request->attributes->get('relay_device_id', '');

        if ($deviceId === '') {
            throw new RelayDomainException('signature_device_invalid', 403);
        }

        return $deviceId;
    }

    private function assertBodyDevice(string $signedDeviceId, string $bodyDeviceId): void
    {
        if (!hash_equals($signedDeviceId, $bodyDeviceId)) {
            throw new RelayDomainException('device_id_conflict', 409);
        }
    }
}
