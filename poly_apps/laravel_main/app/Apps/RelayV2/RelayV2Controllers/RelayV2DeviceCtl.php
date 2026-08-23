<?php

namespace App\Apps\RelayV2\RelayV2Controllers;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Services\RelayV2BlobService;
use App\Apps\RelayV2\RelayV2Services\RelayV2Contract;
use App\Apps\RelayV2\RelayV2Services\RelayV2DeviceService;
use App\Apps\RelayV2\RelayV2Services\RelayV2EnrollmentService;
use App\Apps\RelayV2\RelayV2Services\RelayV2OperationService;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

final class RelayV2DeviceCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly RelayV2EnrollmentService $enrollments,
        private readonly RelayV2DeviceService $devices,
        private readonly RelayV2OperationService $operations,
        private readonly RelayV2BlobService $blobs
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

        return $this->success($this->enrollments->create($validated['device']), __('relay_v2.success'));
    }

    public function enrollmentStatus(Request $request, string $enrollment_id): JsonResponse
    {
        return $this->success(
            $this->enrollments->status($enrollment_id, $this->deviceId($request)),
            __('relay_v2.success')
        );
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'capabilities' => ['required', 'array'],
            'capabilities.*' => ['string', 'max:128'],
        ]);
        $deviceId = $this->deviceId($request);

        $this->assertBodyDevice($deviceId, (string) $validated['device_id']);

        return $this->success($this->devices->heartbeat($deviceId, $validated), __('relay_v2.success'));
    }

    public function hubAuthorization(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
        ]);
        $deviceId = $this->deviceId($request);

        $this->assertBodyDevice($deviceId, (string) $validated['device_id']);

        return $this->success(
            $this->devices->authorization($deviceId, (string) $validated['contract_digest']),
            __('relay_v2.success')
        );
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

        return $this->success($this->devices->event($deviceId, $validated), __('relay_v2.success'));
    }

    public function claim(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'lease_owner' => ['required', 'string', 'max:128'],
            'limit' => ['required', 'integer', 'min:1', 'max:'.RelayV2Contract::limit('claim_batch')],
            'contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
        ]);
        $deviceId = $this->deviceId($request);

        $this->assertBodyDevice($deviceId, (string) $validated['device_id']);

        return $this->success($this->operations->claim($deviceId, $validated), __('relay_v2.success'));
    }

    public function executionStart(Request $request, string $operation_id): JsonResponse
    {
        $validated = $this->validateClaimMutation($request, $operation_id, true);

        return $this->success(
            $this->operations->executionStart($this->deviceId($request), $operation_id, $validated),
            __('relay_v2.success')
        );
    }

    public function renewLease(Request $request, string $operation_id): JsonResponse
    {
        $validated = $this->validateClaimMutation($request, $operation_id, false);

        return $this->success(
            $this->operations->renewLease($this->deviceId($request), $operation_id, $validated),
            __('relay_v2.success')
        );
    }

    public function result(Request $request, string $operation_id): JsonResponse
    {
        $outcomes = array_values(array_map('strval', RelayV2Contract::document()['result_outcomes']));
        $validated = $request->validate([
            'operation_id' => ['required', 'uuid'],
            'operation_revision' => ['required', 'integer', 'min:1'],
            'claim_epoch' => ['required', 'integer', 'min:1'],
            'lease_owner' => ['required', 'string', 'max:128'],
            'outcome' => ['required', Rule::in($outcomes)],
            'status' => ['nullable', 'integer', 'min:100', 'max:599'],
            'headers' => ['nullable', 'array'],
            'body_present' => ['required', 'boolean'],
            'body_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'body_length' => ['required', 'integer', 'min:0'],
            'body_base64' => ['nullable', 'string'],
            'body_ref' => ['nullable', 'uuid'],
            'result_digest' => ['nullable', 'regex:/^[a-f0-9]{64}$/'],
            'error' => ['nullable', 'array'],
            'error.code' => ['nullable', 'string', 'max:128'],
        ]);

        $this->assertBodyOperation($operation_id, (string) $validated['operation_id']);

        return $this->success(
            $this->operations->submitResult($this->deviceId($request), $operation_id, $validated),
            __('relay_v2.success')
        );
    }

    public function requestBlob(Request $request, string $blob_id): Response
    {
        $generation = $this->validateGenerationQuery($request, 'device_request_blob_download');
        $bytes = $this->blobs->readDeviceRequest($this->deviceId($request), $blob_id, $generation);

        return response($bytes, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function allocateResponseBlob(Request $request, string $operation_id): JsonResponse
    {
        $validated = $request->validate([
            'operation_id' => ['required', 'uuid'],
            'direction' => ['required', Rule::in(['response'])],
            'expected_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'expected_length' => ['required', 'integer', 'min:0'],
            'operation_revision' => ['required', 'integer', 'min:1'],
            'claim_epoch' => ['required', 'integer', 'min:1'],
            'lease_owner' => ['required', 'string', 'max:128'],
        ]);

        $this->assertBodyOperation($operation_id, (string) $validated['operation_id']);

        return $this->success(
            $this->blobs->allocateResponse($this->deviceId($request), $operation_id, $validated),
            __('relay_v2.success')
        );
    }

    public function responseBlobChunk(Request $request, string $blob_id, string $chunk_index): JsonResponse
    {
        $chunkIndex = ctype_digit($chunk_index) ? (int) $chunk_index : -1;
        $generation = $this->validateGenerationQuery($request, 'device_response_blob_chunk');

        if ($chunkIndex < 0) {
            throw new RelayV2DomainException('blob_chunk_index_invalid', 422);
        }

        return $this->success(
            $this->blobs->storeDeviceChunk(
                $this->deviceId($request),
                $blob_id,
                $chunkIndex,
                $generation,
                (string) $request->getContent()
            ),
            __('relay_v2.success')
        );
    }

    public function finalizeResponseBlob(Request $request, string $blob_id): JsonResponse
    {
        $validated = $request->validate([
            'blob_id' => ['required', 'uuid'],
            'expected_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'expected_length' => ['required', 'integer', 'min:0'],
            'operation_revision' => ['required', 'integer', 'min:1'],
            'claim_epoch' => ['required', 'integer', 'min:1'],
            'lease_owner' => ['required', 'string', 'max:128'],
        ]);

        if (!hash_equals($blob_id, (string) $validated['blob_id'])) {
            throw new RelayV2DomainException('blob_id_conflict', 409);
        }

        return $this->success(
            $this->blobs->finalizeDevice($this->deviceId($request), $blob_id, $validated),
            __('relay_v2.success')
        );
    }

    private function validateClaimMutation(Request $request, string $operationId, bool $executionStart): array
    {
        $rules = [
            'operation_id' => ['required', 'uuid'],
            'operation_revision' => ['required', 'integer', 'min:1'],
            'claim_epoch' => ['required', 'integer', 'min:1'],
            'lease_owner' => ['required', 'string', 'max:128'],
        ];
        $validated = [];

        if ($executionStart) {
            $rules['request_digest'] = ['required', 'regex:/^[a-f0-9]{64}$/'];
            $rules['retry_policy'] = ['required', Rule::in(array_values(RelayV2Contract::document()['retry_policies']))];
        }
        $validated = $request->validate($rules);
        $this->assertBodyOperation($operationId, (string) $validated['operation_id']);

        return $validated;
    }

    private function deviceId(Request $request): string
    {
        $deviceId = (string) $request->attributes->get('relay_v2_device_id', '');

        if ($deviceId === '') {
            throw new RelayV2DomainException('signature_device_invalid', 403);
        }

        return $deviceId;
    }

    private function validateGenerationQuery(Request $request, string $endpointName): array
    {
        $fields = RelayV2Contract::generationFields($endpointName);
        $query = $request->query();
        $queryNames = array_keys($query);
        $requiredNames = $fields;
        $revisionField = (string) $fields[0];
        $epochField = (string) $fields[1];
        $ownerField = (string) $fields[2];
        $revisionValue = $query[$revisionField] ?? null;
        $epochValue = $query[$epochField] ?? null;
        $leaseOwnerValue = $query[$ownerField] ?? null;
        $revision = is_string($revisionValue) ? $revisionValue : '';
        $epoch = is_string($epochValue) ? $epochValue : '';
        $leaseOwner = is_string($leaseOwnerValue) ? $leaseOwnerValue : '';

        sort($queryNames, SORT_STRING);
        sort($requiredNames, SORT_STRING);
        if ($queryNames !== $requiredNames
            || !is_string($revisionValue)
            || !is_string($epochValue)
            || !is_string($leaseOwnerValue)
            || !ctype_digit($revision)
            || (int) $revision < 1
            || !ctype_digit($epoch)
            || (int) $epoch < 1
            || $leaseOwner === ''
            || strlen($leaseOwner) > 128) {
            throw new RelayV2DomainException('operation_generation_invalid', 422);
        }

        return [
            'operation_revision' => (int) $revision,
            'claim_epoch' => (int) $epoch,
            'lease_owner' => $leaseOwner,
        ];
    }

    private function assertBodyDevice(string $signedDeviceId, string $bodyDeviceId): void
    {
        if (!hash_equals($signedDeviceId, $bodyDeviceId)) {
            throw new RelayV2DomainException('device_id_conflict', 409);
        }
    }

    private function assertBodyOperation(string $routeOperationId, string $bodyOperationId): void
    {
        if (!hash_equals($routeOperationId, $bodyOperationId)) {
            throw new RelayV2DomainException('operation_id_conflict', 409);
        }
    }
}
