<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2BlobModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2OperationModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class RelayV2OperationService
{
    public function __construct(
        private readonly RelayV2DeviceService $devices,
        private readonly RelayV2AuthorizationService $authorization,
        private readonly RelayV2OperationEventService $events,
        private readonly RelayV2BlobService $blobs,
        private readonly RelayV2PairingService $pairings
    ) {
    }

    public function admit(User $user, array $payload): array
    {
        $userId = (int) $user->getAuthIdentifier();
        $operationId = (string) $payload['operation_id'];
        $idempotencyKey = trim((string) $payload['idempotency_key']);
        $pairingId = (string) $payload['pairing_id'];
        $method = strtoupper((string) $payload['method']);
        $path = RelayV2Contract::canonicalPath((string) $payload['path']);
        $query = is_array($payload['query'] ?? null) ? $payload['query'] : [];
        $headers = RelayV2Contract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'request');
        $bodyPresent = (bool) $payload['body_present'];
        $bodySha256 = strtolower((string) $payload['body_sha256']);
        $bodyLength = (int) $payload['body_length'];
        $bodyBase64 = array_key_exists('body_base64', $payload) ? (string) ($payload['body_base64'] ?? '') : null;
        $bodyRef = trim((string) ($payload['body_ref'] ?? ''));
        $policy = RelayV2Contract::routePolicy($path, $method);
        $profileName = (string) ($policy['profile'] ?? 'denied');
        $permission = (string) ($policy['permission'] ?? 'none');
        $retryPolicy = (string) ($policy['retry'] ?? RelayV2Constants::RETRY_AT_MOST_ONCE);
        $payloadProfile = (string) ($policy['payload'] ?? 'none');
        $bodyBytes = '';
        $blobBodyBytes = '';
        $requestDigest = '';
        $connection = DB::connection(RelayV2TablesMaps::connection());

        if ((string) ($policy['exposure'] ?? 'denied') !== 'relay') {
            throw new RelayV2DomainException('route_denied', 403);
        }
        if ($bodyPresent && ($bodyBase64 === null) === ($bodyRef === '')) {
            throw new RelayV2DomainException('request_body_source_invalid', 422);
        }
        if (!$bodyPresent && ($bodyBase64 !== null || $bodyRef !== '')) {
            throw new RelayV2DomainException('request_body_unexpected', 422);
        }
        if ($bodyBase64 !== null) {
            $bodyBytes = base64_decode((string) $bodyBase64, true);
            if (!is_string($bodyBytes)) {
                throw new RelayV2DomainException('request_body_base64_invalid', 422);
            }
            if (strlen($bodyBytes) > RelayV2Contract::limit('inline_body_bytes')) {
                throw new RelayV2DomainException('request_body_inline_too_large', 413);
            }
        }
        if (!$bodyPresent) {
            $bodyBytes = '';
        }
        if ($bodyRef === '' && (strlen($bodyBytes) !== $bodyLength || !hash_equals(hash('sha256', $bodyBytes), $bodySha256))) {
            throw new RelayV2DomainException('request_body_digest_conflict', 409);
        }
        if ($bodyLength < 0 || $bodyLength > RelayV2Contract::limit('request_body_bytes')) {
            throw new RelayV2DomainException('request_body_too_large', 413);
        }
        $this->validatePayloadProfile($payloadProfile, $bodyPresent, $bodyBytes, $bodyRef);
        if ($bodyRef !== '' && $payloadProfile === 'json-object') {
            $blobBodyBytes = $this->blobs->readOwnerRequest($userId, $bodyRef);
            $this->validatePayloadProfile($payloadProfile, true, $blobBodyBytes, '');
        }
        $requestDigest = RelayV2Contract::requestDigest(
            $method,
            $path,
            $query,
            $headers,
            $bodyPresent,
            $bodySha256,
            $bodyLength
        );

        return $connection->transaction(function () use (
            $user,
            $userId,
            $operationId,
            $idempotencyKey,
            $pairingId,
            $method,
            $path,
            $query,
            $headers,
            $bodyPresent,
            $bodySha256,
            $bodyLength,
            $bodyBase64,
            $bodyRef,
            $profileName,
            $permission,
            $retryPolicy,
            $requestDigest
        ): array {
            $lockedUser = User::query()->whereKey($userId)->lockForUpdate()->first();
            $pairing = $this->pairings->requireActive($userId, $pairingId, true);
            $blob = null;
            $existing = null;
            $inserted = 0;
            $pendingCount = 0;

            if ($lockedUser === null) {
                throw new RelayV2DomainException('authentication_required', 401);
            }
            $this->authorization->authorizeRoute($user, $pairing, $permission);
            if ($bodyRef !== '') {
                $blob = RelayV2BlobModel::query()
                    ->where('blob_id', $bodyRef)
                    ->where('owner_user_id', $userId)
                    ->where('device_id', (string) $pairing->device_id)
                    ->where('pairing_id', $pairingId)
                    ->where('direction', RelayV2Constants::BLOB_REQUEST)
                    ->whereNotNull('finalized_at')
                    ->where('expires_at', '>', now())
                    ->lockForUpdate()
                    ->first();
                if ($blob === null
                    || (int) $blob->final_length !== $bodyLength
                    || !hash_equals((string) $blob->final_sha256, $bodySha256)) {
                    throw new RelayV2DomainException('request_blob_invalid', 409);
                }
                if ($blob->operation_id !== null
                    && !hash_equals((string) $blob->operation_id, $operationId)) {
                    throw new RelayV2DomainException('request_blob_operation_conflict', 409);
                }
            }
            $existing = RelayV2OperationModel::query()
                ->where(static function ($queryBuilder) use ($operationId, $userId, $pairing, $idempotencyKey): void {
                    $queryBuilder->where('operation_id', $operationId)
                        ->orWhere(static function ($idempotencyQuery) use ($userId, $pairing, $idempotencyKey): void {
                            $idempotencyQuery->where('user_id', $userId)
                                ->where('device_id', (string) $pairing->device_id)
                                ->where('idempotency_key', $idempotencyKey);
                        });
                })
                ->lockForUpdate()
                ->first();
            if ($existing !== null) {
                return ['operation' => $this->resolveAdmissionDuplicate(
                    $existing,
                    $requestDigest,
                    $userId,
                    (string) $pairing->device_id,
                    $pairingId,
                    $idempotencyKey,
                    $operationId
                )];
            }
            $pendingCount = RelayV2OperationModel::query()
                ->where('user_id', $userId)
                ->whereNotIn('state', $this->terminalStates())
                ->count();
            if ($pendingCount >= RelayV2Contract::limit('owner_pending_operations')) {
                throw new RelayV2DomainException('owner_pending_limit', 429);
            }
            $inserted = RelayV2OperationModel::query()->insertOrIgnore([[
                'operation_id' => $operationId,
                'idempotency_key' => $idempotencyKey,
                'user_id' => $userId,
                'device_id' => (string) $pairing->device_id,
                'pairing_id' => $pairingId,
                'route_policy_key' => $profileName,
                'permission' => $permission,
                'retry_policy' => $retryPolicy,
                'method' => $method,
                'normalized_path' => $path,
                'normalized_query' => json_encode($query, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'filtered_headers' => json_encode($headers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'request_digest' => $requestDigest,
                'request_body_present' => $bodyPresent,
                'request_body_base64' => $bodyBase64,
                'request_blob_id' => $bodyRef !== '' ? $bodyRef : null,
                'request_body_sha256' => $bodySha256,
                'request_body_length' => $bodyLength,
                'state' => RelayV2Constants::STATE_ACCEPTED,
                'revision' => 1,
                'attempt' => 0,
                'claim_epoch' => 0,
                'accepted_at' => now(),
                'expires_at' => now()->addSeconds(RelayV2Contract::duration('operation_retention_seconds')),
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
            $existing = RelayV2OperationModel::query()
                ->where(static function ($queryBuilder) use ($operationId, $userId, $pairing, $idempotencyKey): void {
                    $queryBuilder->where('operation_id', $operationId)
                        ->orWhere(static function ($idempotencyQuery) use ($userId, $pairing, $idempotencyKey): void {
                            $idempotencyQuery->where('user_id', $userId)
                                ->where('device_id', (string) $pairing->device_id)
                                ->where('idempotency_key', $idempotencyKey);
                        });
                })
                ->lockForUpdate()
                ->first();
            if ($existing === null) {
                throw new RelayV2DomainException('operation_admission_failed', 500);
            }
            if ($inserted !== 1) {
                return ['operation' => $this->resolveAdmissionDuplicate(
                    $existing,
                    $requestDigest,
                    $userId,
                    (string) $pairing->device_id,
                    $pairingId,
                    $idempotencyKey,
                    $operationId
                )];
            }
            if ($blob !== null && $blob->operation_id === null) {
                $blob->forceFill(['operation_id' => $operationId, 'updated_at' => now()])->save();
            }
            $this->events->wake($existing);
            $this->events->status($existing);

            return ['operation' => $this->ownerDescriptor($existing)];
        }, 3);
    }

    public function claim(string $deviceId, array $payload): array
    {
        $leaseOwner = trim((string) $payload['lease_owner']);
        $limit = min((int) $payload['limit'], RelayV2Contract::limit('claim_batch'));
        $connection = DB::connection(RelayV2TablesMaps::connection());

        $this->devices->activeDevice($deviceId);
        if (!hash_equals(RelayV2Contract::digest(), (string) $payload['contract_digest'])) {
            throw new RelayV2DomainException('contract_digest_conflict', 409);
        }

        return $connection->transaction(function () use ($deviceId, $leaseOwner, $limit): array {
            $activeLeases = RelayV2OperationModel::query()
                ->where('device_id', $deviceId)
                ->whereIn('state', [RelayV2Constants::STATE_LEASED, RelayV2Constants::STATE_EXECUTING])
                ->where('lease_expires_at', '>', now())
                ->count();
            $capacity = max(0, RelayV2Contract::limit('device_active_leases') - $activeLeases);
            $rows = collect();
            $operations = [];
            $leaseExpiresAt = now()->addSeconds(RelayV2Contract::duration('operation_lease_seconds'));

            if ($capacity === 0 || $limit < 1) {
                return ['operations' => []];
            }
            $rows = RelayV2OperationModel::query()
                ->where('device_id', $deviceId)
                ->where('expires_at', '>', now())
                ->where(static function ($query): void {
                    $query->where('state', RelayV2Constants::STATE_ACCEPTED)
                        ->orWhere('state', RelayV2Constants::STATE_CANCEL_REQUESTED)
                        ->orWhere(static function ($expired): void {
                            $expired->whereIn('state', [RelayV2Constants::STATE_LEASED, RelayV2Constants::STATE_EXECUTING])
                                ->where('lease_expires_at', '<=', now());
                        });
                })
                ->orderBy('id')
                ->limit(min($limit, $capacity))
                ->lock('for update skip locked')
                ->get();
            foreach ($rows as $operation) {
                if (!$this->pairingStillActive($operation)) {
                    $this->expireUnclaimable($operation);
                    continue;
                }
                if ((string) $operation->state === RelayV2Constants::STATE_EXECUTING
                    && (string) $operation->retry_policy === RelayV2Constants::RETRY_AT_MOST_ONCE) {
                    $this->transitionExpiredExecutionToUnknown($operation);
                    continue;
                }
                if ((string) $operation->state !== RelayV2Constants::STATE_CANCEL_REQUESTED) {
                    $operation->state = RelayV2Constants::STATE_LEASED;
                    $operation->revision = (int) $operation->revision + 1;
                }
                $operation->claim_epoch = (int) $operation->claim_epoch + 1;
                $operation->attempt = (int) $operation->attempt + 1;
                $operation->lease_owner = $leaseOwner;
                $operation->lease_expires_at = $leaseExpiresAt;
                $operation->updated_at = now();
                $operation->save();
                if ((string) $operation->state === RelayV2Constants::STATE_LEASED) {
                    $this->events->status($operation);
                }
                $operations[] = $this->claimDescriptor($operation);
            }

            return ['operations' => $operations];
        }, 3);
    }

    public function executionStart(string $deviceId, string $operationId, array $payload): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($deviceId, $operationId, $payload): array {
            $operation = $this->lockedDeviceOperation($deviceId, $operationId);
            $requestRevision = (int) $payload['operation_revision'];
            $epoch = (int) $payload['claim_epoch'];
            $leaseOwner = (string) $payload['lease_owner'];

            $this->assertClaimIdentity($operation, $epoch, $leaseOwner);
            if (!hash_equals((string) $operation->request_digest, (string) $payload['request_digest'])
                || !hash_equals((string) $operation->retry_policy, (string) $payload['retry_policy'])) {
                throw new RelayV2DomainException('execution_start_conflict', 409);
            }
            if ((string) $operation->state === RelayV2Constants::STATE_EXECUTING
                && ($requestRevision === (int) $operation->revision
                    || $requestRevision + 1 === (int) $operation->revision)) {
                $this->events->status($operation);
                return ['operation' => $this->leaseDescriptor($operation)];
            }
            if ((string) $operation->state !== RelayV2Constants::STATE_LEASED
                || $requestRevision !== (int) $operation->revision
                || $operation->lease_expires_at === null
                || $operation->lease_expires_at->lte(now())) {
                throw new RelayV2DomainException('execution_start_stale', 409);
            }
            $operation->forceFill([
                'state' => RelayV2Constants::STATE_EXECUTING,
                'revision' => (int) $operation->revision + 1,
                'execution_started_at' => $operation->execution_started_at ?? now(),
                'lease_expires_at' => now()->addSeconds(RelayV2Contract::duration('operation_lease_seconds')),
                'updated_at' => now(),
            ])->save();
            $this->events->status($operation);

            return ['operation' => $this->leaseDescriptor($operation)];
        }, 3);
    }

    public function renewLease(string $deviceId, string $operationId, array $payload): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($deviceId, $operationId, $payload): array {
            $operation = $this->lockedDeviceOperation($deviceId, $operationId);

            $this->assertClaimIdentity($operation, (int) $payload['claim_epoch'], (string) $payload['lease_owner']);
            if ((string) $operation->state !== RelayV2Constants::STATE_EXECUTING
                || (int) $operation->revision !== (int) $payload['operation_revision']
                || $operation->lease_expires_at === null
                || $operation->lease_expires_at->lte(now())) {
                throw new RelayV2DomainException('lease_renewal_stale', 409);
            }
            $operation->forceFill([
                'lease_expires_at' => now()->addSeconds(RelayV2Contract::duration('operation_lease_seconds')),
                'updated_at' => now(),
            ])->save();

            return ['operation' => $this->leaseDescriptor($operation)];
        }, 3);
    }

    public function submitResult(string $deviceId, string $operationId, array $payload): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($deviceId, $operationId, $payload): array {
            $operation = $this->lockedDeviceOperation($deviceId, $operationId);
            $outcome = (string) $payload['outcome'];
            $status = array_key_exists('status', $payload) ? (int) $payload['status'] : null;
            $headers = RelayV2Contract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'response');
            $bodyPresent = (bool) $payload['body_present'];
            $bodySha256 = strtolower((string) $payload['body_sha256']);
            $bodyLength = (int) $payload['body_length'];
            $bodyBase64 = array_key_exists('body_base64', $payload) ? (string) ($payload['body_base64'] ?? '') : null;
            $bodyRef = trim((string) ($payload['body_ref'] ?? ''));
            $resultDigest = strtolower((string) ($payload['result_digest'] ?? ''));
            $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
            $bodyBytes = '';
            $responseBlob = null;

            if (in_array((string) $operation->state, $this->terminalStates(), true)) {
                $descriptor = $this->resolveResultDuplicate($operation, $payload);
                $this->events->status($operation);

                return ['operation' => $descriptor];
            }
            $this->assertClaimIdentity($operation, (int) $payload['claim_epoch'], (string) $payload['lease_owner']);
            if ((int) $operation->revision !== (int) $payload['operation_revision']) {
                throw new RelayV2DomainException('operation_revision_conflict', 409);
            }
            $this->assertResultTransition($operation, $outcome);
            if ($bodyPresent && ($bodyBase64 === null) === ($bodyRef === '')) {
                throw new RelayV2DomainException('response_body_source_invalid', 422);
            }
            if (!$bodyPresent && ($bodyBase64 !== null || $bodyRef !== '')) {
                throw new RelayV2DomainException('response_body_unexpected', 422);
            }
            if ($bodyBase64 !== null) {
                $bodyBytes = base64_decode((string) $bodyBase64, true);
                if (!is_string($bodyBytes)
                    || strlen($bodyBytes) > RelayV2Contract::limit('inline_body_bytes')) {
                    throw new RelayV2DomainException('response_body_base64_invalid', 422);
                }
            }
            if ($bodyRef !== '') {
                $responseBlob = $this->responseBlob($operation, $bodyRef, true);
                if ((int) $responseBlob->final_length !== $bodyLength
                    || !hash_equals((string) $responseBlob->final_sha256, $bodySha256)) {
                    throw new RelayV2DomainException('response_blob_digest_conflict', 409);
                }
            } elseif (strlen($bodyBytes) !== $bodyLength
                || !hash_equals(hash('sha256', $bodyBytes), $bodySha256)) {
                throw new RelayV2DomainException('response_body_digest_conflict', 409);
            }
            if ($bodyLength < 0 || $bodyLength > RelayV2Contract::limit('response_body_bytes')) {
                throw new RelayV2DomainException('response_body_too_large', 413);
            }
            if (in_array($outcome, [RelayV2Constants::STATE_RESPONDED, RelayV2Constants::STATE_FAILED], true)
                && (string) $operation->state === RelayV2Constants::STATE_EXECUTING) {
                if ($status === null || $status < 100 || $status > 599) {
                    throw new RelayV2DomainException('response_status_invalid', 422);
                }
                $expectedResultDigest = RelayV2Contract::resultDigest($status, $headers, $bodyPresent, $bodySha256, $bodyLength);
                if (!hash_equals($expectedResultDigest, $resultDigest)) {
                    throw new RelayV2DomainException('result_digest_conflict', 409);
                }
            } else {
                $resultDigest = '';
            }
            $operation->forceFill([
                'state' => $outcome,
                'revision' => (int) $operation->revision + 1,
                'response_status' => $status,
                'response_headers' => $headers,
                'response_body_present' => $bodyPresent,
                'response_body_base64' => $bodyBase64,
                'response_blob_id' => $bodyRef !== '' ? $bodyRef : null,
                'response_body_sha256' => $bodySha256,
                'response_body_length' => $bodyLength,
                'result_digest' => $resultDigest !== '' ? $resultDigest : null,
                'error_code' => isset($error['code']) ? mb_substr((string) $error['code'], 0, 128) : null,
                'completed_at' => now(),
                'lease_expires_at' => null,
                'updated_at' => now(),
            ])->save();
            $this->events->status($operation);

            return ['operation' => $this->ownerDescriptor($operation)];
        }, 3);
    }

    public function show(int $userId, string $operationId): array
    {
        $operation = RelayV2OperationModel::query()
            ->where('operation_id', $operationId)
            ->where('user_id', $userId)
            ->first();

        if ($operation === null) {
            throw new RelayV2DomainException('operation_not_found', 404);
        }

        return ['operation' => $this->ownerDescriptor($operation)];
    }

    public function cancel(int $userId, string $operationId): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($userId, $operationId): array {
            $operation = RelayV2OperationModel::query()
                ->where('operation_id', $operationId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();

            if ($operation === null) {
                throw new RelayV2DomainException('operation_not_found', 404);
            }
            if (in_array((string) $operation->state, $this->terminalStates(), true)
                || (string) $operation->state === RelayV2Constants::STATE_CANCEL_REQUESTED) {
                if ((string) $operation->state === RelayV2Constants::STATE_CANCEL_REQUESTED) {
                    $this->events->wake($operation);
                }
                $this->events->status($operation);
                return ['operation' => $this->ownerDescriptor($operation)];
            }
            if (!RelayV2Contract::transitionAllowed((string) $operation->state, RelayV2Constants::STATE_CANCEL_REQUESTED)) {
                throw new RelayV2DomainException('operation_transition_invalid', 409);
            }
            $operation->forceFill([
                'state' => RelayV2Constants::STATE_CANCEL_REQUESTED,
                'revision' => (int) $operation->revision + 1,
                'updated_at' => now(),
            ])->save();
            $this->events->wake($operation);
            $this->events->status($operation);

            return ['operation' => $this->ownerDescriptor($operation)];
        }, 3);
    }

    public function requestBlob(string $deviceId, string $blobId): RelayV2BlobModel
    {
        $blob = RelayV2BlobModel::query()
            ->where('blob_id', $blobId)
            ->where('device_id', $deviceId)
            ->where('direction', RelayV2Constants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayV2DomainException('request_blob_not_found', 404);
        }

        return $blob;
    }

    private function validatePayloadProfile(string $profile, bool $bodyPresent, string $bodyBytes, string $bodyRef): void
    {
        $decoded = null;

        if ($profile !== 'json-object') {
            return;
        }
        if (!$bodyPresent) {
            throw new RelayV2DomainException('route_payload_invalid', 422);
        }
        if ($bodyRef !== '') {
            return;
        }
        $decoded = json_decode($bodyBytes, true);
        if (!is_array($decoded) || array_is_list($decoded)) {
            throw new RelayV2DomainException('route_payload_invalid', 422);
        }
    }

    private function resolveAdmissionDuplicate(
        RelayV2OperationModel $operation,
        string $requestDigest,
        int $userId,
        string $deviceId,
        string $pairingId,
        string $idempotencyKey,
        string $operationId
    ): array {
        $sameOwnerKey = (int) $operation->user_id === $userId
            && hash_equals((string) $operation->device_id, $deviceId)
            && hash_equals((string) $operation->idempotency_key, $idempotencyKey);
        $sameOperationIdentity = hash_equals((string) $operation->operation_id, $operationId)
            && (int) $operation->user_id === $userId
            && hash_equals((string) $operation->device_id, $deviceId)
            && hash_equals((string) $operation->pairing_id, $pairingId);

        if ((!$sameOwnerKey && !$sameOperationIdentity)
            || !hash_equals((string) $operation->request_digest, $requestDigest)) {
            throw new RelayV2DomainException('idempotency_conflict', 409);
        }
        if (in_array((string) $operation->state, [
            RelayV2Constants::STATE_ACCEPTED,
            RelayV2Constants::STATE_CANCEL_REQUESTED,
        ], true)) {
            $this->events->wake($operation);
        }
        $this->events->status($operation);

        return $this->ownerDescriptor($operation);
    }

    private function pairingStillActive(RelayV2OperationModel $operation): bool
    {
        return $this->pairings->isActiveForDevice(
            (int) $operation->user_id,
            (string) $operation->pairing_id,
            (string) $operation->device_id
        );
    }

    private function expireUnclaimable(RelayV2OperationModel $operation): void
    {
        $target = (string) $operation->state === RelayV2Constants::STATE_EXECUTING
            ? RelayV2Constants::STATE_EXECUTION_UNKNOWN
            : RelayV2Constants::STATE_EXPIRED;

        $operation->forceFill([
            'state' => $target,
            'revision' => (int) $operation->revision + 1,
            'error_code' => 'pairing_inactive',
            'completed_at' => now(),
            'lease_expires_at' => null,
            'updated_at' => now(),
        ])->save();
        $this->events->status($operation);
    }

    private function transitionExpiredExecutionToUnknown(RelayV2OperationModel $operation): void
    {
        $operation->forceFill([
            'state' => RelayV2Constants::STATE_EXECUTION_UNKNOWN,
            'revision' => (int) $operation->revision + 1,
            'error_code' => 'execution_lease_expired',
            'completed_at' => now(),
            'lease_expires_at' => null,
            'updated_at' => now(),
        ])->save();
        $this->events->status($operation);
    }

    private function lockedDeviceOperation(string $deviceId, string $operationId): RelayV2OperationModel
    {
        $operation = RelayV2OperationModel::query()
            ->where('operation_id', $operationId)
            ->where('device_id', $deviceId)
            ->lockForUpdate()
            ->first();

        if ($operation === null) {
            throw new RelayV2DomainException('operation_not_found', 404);
        }

        return $operation;
    }

    private function assertClaimIdentity(RelayV2OperationModel $operation, int $epoch, string $leaseOwner): void
    {
        if ($epoch < 1
            || $leaseOwner === ''
            || (int) $operation->claim_epoch !== $epoch
            || !hash_equals((string) $operation->lease_owner, $leaseOwner)) {
            throw new RelayV2DomainException('operation_claim_stale', 409);
        }
    }

    private function assertResultTransition(RelayV2OperationModel $operation, string $outcome): void
    {
        $state = (string) $operation->state;
        $allowed = [];

        if ($state === RelayV2Constants::STATE_EXECUTING) {
            $allowed = [RelayV2Constants::STATE_RESPONDED, RelayV2Constants::STATE_FAILED, RelayV2Constants::STATE_EXECUTION_UNKNOWN];
        } elseif (in_array($state, [RelayV2Constants::STATE_LEASED, RelayV2Constants::STATE_CANCEL_REQUESTED], true)) {
            $allowed = [RelayV2Constants::STATE_FAILED, RelayV2Constants::STATE_CANCELED, RelayV2Constants::STATE_EXPIRED];
        }
        if (!in_array($outcome, $allowed, true)) {
            throw new RelayV2DomainException('operation_result_transition_invalid', 409);
        }
    }

    private function responseBlob(RelayV2OperationModel $operation, string $blobId, bool $finalized): RelayV2BlobModel
    {
        $query = RelayV2BlobModel::query()
            ->where('blob_id', $blobId)
            ->where('operation_id', (string) $operation->operation_id)
            ->where('owner_user_id', (int) $operation->user_id)
            ->where('device_id', (string) $operation->device_id)
            ->where('pairing_id', (string) $operation->pairing_id)
            ->where('direction', RelayV2Constants::BLOB_RESPONSE)
            ->where('expires_at', '>', now());

        if ($finalized) {
            $query->whereNotNull('finalized_at');
        }
        $blob = $query->lockForUpdate()->first();
        if ($blob === null) {
            throw new RelayV2DomainException('response_blob_not_found', 404);
        }
        if ((int) $blob->operation_revision !== (int) $operation->revision
            || (int) $blob->claim_epoch !== (int) $operation->claim_epoch
            || !hash_equals((string) $blob->lease_owner, (string) $operation->lease_owner)) {
            throw new RelayV2DomainException('blob_claim_stale', 409);
        }

        return $blob;
    }

    private function resolveResultDuplicate(RelayV2OperationModel $operation, array $payload): array
    {
        $outcome = (string) $payload['outcome'];
        $resultDigest = strtolower((string) ($payload['result_digest'] ?? ''));
        $bodySha256 = strtolower((string) $payload['body_sha256']);
        $status = array_key_exists('status', $payload) ? (int) $payload['status'] : null;
        $bodyPresent = (bool) $payload['body_present'];
        $bodyBase64 = array_key_exists('body_base64', $payload) ? (string) ($payload['body_base64'] ?? '') : null;
        $bodyRef = trim((string) ($payload['body_ref'] ?? ''));
        $headers = RelayV2Contract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'response');
        $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
        $errorCode = isset($error['code']) ? mb_substr((string) $error['code'], 0, 128) : null;

        if ((string) $operation->state !== $outcome
            || (int) $operation->revision !== (int) $payload['operation_revision'] + 1
            || (int) $operation->claim_epoch !== (int) $payload['claim_epoch']
            || !hash_equals((string) $operation->lease_owner, (string) $payload['lease_owner'])
            || !hash_equals((string) ($operation->result_digest ?? ''), $resultDigest)
            || !hash_equals((string) ($operation->response_body_sha256 ?? ''), $bodySha256)
            || (int) ($operation->response_body_length ?? 0) !== (int) $payload['body_length']
            || $operation->response_status !== $status
            || !hash_equals(
                RelayV2Contract::canonicalJson($operation->response_headers ?? []),
                RelayV2Contract::canonicalJson($headers)
            )
            || (bool) $operation->response_body_present !== $bodyPresent
            || $operation->response_body_base64 !== $bodyBase64
            || $operation->response_blob_id !== ($bodyRef !== '' ? $bodyRef : null)
            || $operation->error_code !== $errorCode) {
            throw new RelayV2DomainException('operation_result_conflict', 409);
        }

        return $this->ownerDescriptor($operation);
    }

    private function claimDescriptor(RelayV2OperationModel $operation): array
    {
        $descriptor = [
            'operation_id' => (string) $operation->operation_id,
            'revision' => (int) $operation->revision,
            'state' => (string) $operation->state,
            'claim_epoch' => (int) $operation->claim_epoch,
            'lease_owner' => (string) $operation->lease_owner,
            'lease_expires_at' => $operation->lease_expires_at?->toIso8601String(),
            'pairing_id' => (string) $operation->pairing_id,
            'user_id' => (string) $operation->user_id,
            'method' => (string) $operation->method,
            'path' => (string) $operation->normalized_path,
            'query' => $operation->normalized_query ?? [],
            'headers' => $operation->filtered_headers ?? [],
            'body_present' => (bool) $operation->request_body_present,
            'body_sha256' => (string) $operation->request_body_sha256,
            'body_length' => (int) $operation->request_body_length,
            'request_digest' => (string) $operation->request_digest,
        ];

        if ((bool) $operation->request_body_present) {
            if ($operation->request_blob_id !== null) {
                $descriptor['body_ref'] = (string) $operation->request_blob_id;
            } else {
                $descriptor['body_base64'] = (string) $operation->request_body_base64;
            }
        }

        return $descriptor;
    }

    private function leaseDescriptor(RelayV2OperationModel $operation): array
    {
        return [
            'state' => (string) $operation->state,
            'revision' => (int) $operation->revision,
            'claim_epoch' => (int) $operation->claim_epoch,
            'server_time' => now()->toIso8601String(),
            'lease_expires_at' => $operation->lease_expires_at?->toIso8601String(),
        ];
    }

    private function ownerDescriptor(RelayV2OperationModel $operation): array
    {
        return [
            'operation_id' => (string) $operation->operation_id,
            'device_id' => (string) $operation->device_id,
            'pairing_id' => (string) $operation->pairing_id,
            'state' => (string) $operation->state,
            'revision' => (int) $operation->revision,
            'retry_policy' => (string) $operation->retry_policy,
            'response_status' => $operation->response_status === null ? null : (int) $operation->response_status,
            'response_headers' => $operation->response_headers,
            'response_body_present' => $operation->response_body_present,
            'response_body_base64' => $operation->response_body_base64,
            'response_body_ref' => $operation->response_blob_id,
            'response_body_sha256' => $operation->response_body_sha256,
            'response_body_length' => $operation->response_body_length,
            'error_code' => $operation->error_code,
            'accepted_at' => $operation->accepted_at?->toIso8601String(),
            'execution_started_at' => $operation->execution_started_at?->toIso8601String(),
            'completed_at' => $operation->completed_at?->toIso8601String(),
            'expires_at' => $operation->expires_at?->toIso8601String(),
        ];
    }

    private function terminalStates(): array
    {
        return [
            RelayV2Constants::STATE_RESPONDED,
            RelayV2Constants::STATE_FAILED,
            RelayV2Constants::STATE_EXECUTION_UNKNOWN,
            RelayV2Constants::STATE_EXPIRED,
            RelayV2Constants::STATE_CANCELED,
        ];
    }
}
