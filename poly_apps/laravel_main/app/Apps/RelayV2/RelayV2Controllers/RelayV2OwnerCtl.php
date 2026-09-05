<?php

namespace App\Apps\RelayV2\RelayV2Controllers;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Services\RelayV2BlobService;
use App\Apps\RelayV2\RelayV2Services\RelayV2EnrollmentService;
use App\Apps\RelayV2\RelayV2Services\RelayV2OperationService;
use App\Apps\RelayV2\RelayV2Services\RelayV2OwnerResolver;
use App\Apps\RelayV2\RelayV2Services\RelayV2PairingService;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RelayV2OwnerCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly RelayV2OwnerResolver $owners,
        private readonly RelayV2EnrollmentService $enrollments,
        private readonly RelayV2PairingService $pairings,
        private readonly RelayV2OperationService $operations,
        private readonly RelayV2BlobService $blobs
    ) {
    }

    public function claimEnrollment(Request $request): JsonResponse
    {
        $validated = $request->validate(['claim_code' => ['required', 'string', 'max:16']]);
        $user = $this->user($request);

        return $this->success(
            $this->enrollments->claim((int) $user->getAuthIdentifier(), (string) $validated['claim_code']),
            __('relay_v2.success')
        );
    }

    public function roster(Request $request): JsonResponse
    {
        $user = $this->user($request);

        $this->enrollments->autoClaimPending((int) $user->getAuthIdentifier());

        return $this->success($this->pairings->roster((int) $user->getAuthIdentifier()), __('relay_v2.success'));
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
        ), __('relay_v2.success'));
    }

    public function renewPairing(Request $request, string $pairingId): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->pairings->renew((int) $user->getAuthIdentifier(), $pairingId),
            __('relay_v2.success')
        );
    }

    public function revokePairing(Request $request, string $pairingId): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->pairings->revoke((int) $user->getAuthIdentifier(), $pairingId),
            __('relay_v2.success')
        );
    }

    public function hubAuthorization(Request $request): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->pairings->authorization((int) $user->getAuthIdentifier()),
            __('relay_v2.success')
        );
    }

    public function admitOperation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'operation_id' => ['required', 'uuid'],
            'idempotency_key' => ['required', 'string', 'max:128'],
            'pairing_id' => ['required', 'uuid'],
            'method' => ['required', 'string', 'max:16'],
            'path' => ['required', 'string', 'max:4096'],
            'query' => ['present', 'array'],
            'headers' => ['present', 'array'],
            'body_present' => ['required', 'boolean'],
            'body_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'body_length' => ['required', 'integer', 'min:0'],
            'body_base64' => ['nullable', 'string'],
            'body_ref' => ['nullable', 'uuid'],
        ]);

        return $this->success(
            $this->operations->admit($this->user($request), $validated),
            __('relay_v2.accepted'),
            202
        );
    }

    public function operation(Request $request, string $operationId): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->operations->show((int) $user->getAuthIdentifier(), $operationId),
            __('relay_v2.success')
        );
    }

    public function cancelOperation(Request $request, string $operationId): JsonResponse
    {
        $user = $this->user($request);

        return $this->success(
            $this->operations->cancel((int) $user->getAuthIdentifier(), $operationId),
            __('relay_v2.success')
        );
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
            __('relay_v2.success')
        );
    }

    public function requestBlobChunk(Request $request, string $blobId, string $chunkIndex): JsonResponse
    {
        $user = $this->user($request);
        $index = ctype_digit($chunkIndex) ? (int) $chunkIndex : -1;

        if ($index < 0) {
            throw new RelayV2DomainException('blob_chunk_index_invalid', 422);
        }

        return $this->success(
            $this->blobs->storeOwnerChunk((int) $user->getAuthIdentifier(), $blobId, $index, (string) $request->getContent()),
            __('relay_v2.success')
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
            throw new RelayV2DomainException('blob_id_conflict', 409);
        }

        return $this->success(
            $this->blobs->finalizeOwner((int) $user->getAuthIdentifier(), $blobId, $validated),
            __('relay_v2.success')
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

    private function user(Request $request): User
    {
        return $this->owners->resolve($request);
    }
}
