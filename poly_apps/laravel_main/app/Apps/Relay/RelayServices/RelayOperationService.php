<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayBlobModel;
use App\Apps\Relay\RelayModels\RelayOperationModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class RelayOperationService
{
    public function __construct(
        private readonly RelayDeviceService $devices,
        private readonly RelayAuthorizationService $authorization,
        private readonly RelayOperationEventService $events,
        private readonly RelayBlobService $blobs,
        private readonly RelayPairingService $pairings
    ) {
    }

    public function admit(User $user, array $payload): array
    {
        $userId = (int) $user->getAuthIdentifier();
        $operationId = (string) $payload['operation_id'];
        $idempotencyKey = trim((string) $payload['idempotency_key']);
        $pairingId = (string) $payload['pairing_id'];
        $method = strtoupper((string) $payload['method']);
        $path = RelayContract::canonicalPath((string) $payload['path']);
        $query = is_array($payload['query'] ?? null) ? $payload['query'] : [];
        $headers = RelayContract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'request');
        $bodyPresent = (bool) $payload['body_present'];
        $bodySha256 = strtolower((string) $payload['body_sha256']);
        $bodyLength = (int) $payload['body_length'];
        $bodyBase64 = array_key_exists('body_base64', $payload) ? (string) ($payload['body_base64'] ?? '') : null;
        $bodyRef = trim((string) ($payload['body_ref'] ?? ''));
        $policy = RelayContract::routePolicy($path, $method);
        $profileName = (string) ($policy['profile'] ?? 'denied');
        $permission = (string) ($policy['permission'] ?? 'none');
        $retryPolicy = (string) ($policy['retry'] ?? RelayConstants::RETRY_AT_MOST_ONCE);
        $payloadProfile = (string) ($policy['payload'] ?? 'none');
        $bodyBytes = '';
        $blobBodyBytes = '';
        $requestDigest = '';
        $connection = DB::connection(RelayTablesMaps::connection());

        if ((string) ($policy['exposure'] ?? 'denied') !== 'relay') {
            throw new RelayDomainException('route_denied', 403);
        }
        if ($bodyPresent && ($bodyBase64 === null) === ($bodyRef === '')) {
            throw new RelayDomainException('request_body_source_invalid', 422);
        }
        if (!$bodyPresent && ($bodyBase64 !== null || $bodyRef !== '')) {
            throw new RelayDomainException('request_body_unexpected', 422);
        }
        if ($bodyBase64 !== null) {
            $bodyBytes = base64_decode((string) $bodyBase64, true);
            if (!is_string($bodyBytes)) {
                throw new RelayDomainException('request_body_base64_invalid', 422);
            }
            if (strlen($bodyBytes) > RelayContract::limit('inline_body_bytes')) {
                throw new RelayDomainException('request_body_inline_too_large', 413);
            }
        }
        if (!$bodyPresent) {
            $bodyBytes = '';
        }
        if ($bodyRef === '' && (strlen($bodyBytes) !== $bodyLength || !hash_equals(hash('sha256', $bodyBytes), $bodySha256))) {
            throw new RelayDomainException('request_body_digest_conflict', 409);
        }
        if ($bodyLength < 0 || $bodyLength > RelayContract::limit('request_body_bytes')) {
            throw new RelayDomainException('request_body_too_large', 413);
        }
        $this->validatePayloadProfile($payloadProfile, $bodyPresent, $bodyBytes, $bodyRef);
        if ($bodyRef !== '' && $payloadProfile === 'json-object') {
            $blobBodyBytes = $this->blobs->readOwnerRequest($userId, $bodyRef);
            $this->validatePayloadProfile($payloadProfile, true, $blobBodyBytes, '');
        }
        $requestDigest = RelayContract::requestDigest(
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
                throw new RelayDomainException('group_empty', 503);
            }
            $this->authorization->authorizeRoute($user, $pairing, $permission);
            if ($bodyRef !== '') {
                $blob = RelayBlobModel::query()
                    ->where('blob_id', $bodyRef)
                    ->where('owner_user_id', $userId)
                    ->where('device_id', (string) $pairing->device_id)
                    ->where('pairing_id', $pairingId)
                    ->where('direction', RelayConstants::BLOB_REQUEST)
                    ->whereNotNull('finalized_at')
                    ->where('expires_at', '>', now())
                    ->lockForUpdate()
                    ->first();
                if ($blob === null
                    || (int) $blob->final_length !== $bodyLength
                    || !hash_equals((string) $blob->final_sha256, $bodySha256)) {
                    throw new RelayDomainException('request_blob_invalid', 409);
                }
                if ($blob->operation_id !== null
                    && !hash_equals((string) $blob->operation_id, $operationId)) {
                    throw new RelayDomainException('request_blob_operation_conflict', 409);
                }
            }
            $existing = RelayOperationModel::query()
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
            $pendingCount = RelayOperationModel::query()
                ->where('user_id', $userId)
                ->whereNotIn('state', $this->terminalStates())
                ->count();
            if ($pendingCount >= RelayContract::limit('owner_pending_operations')) {
                throw new RelayDomainException('owner_pending_limit', 429);
            }
            $inserted = RelayOperationModel::query()->insertOrIgnore([[
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
                'state' => RelayConstants::STATE_ACCEPTED,
                'revision' => 1,
                'attempt' => 0,
                'claim_epoch' => 0,
                'accepted_at' => now(),
                'expires_at' => now()->addSeconds(RelayContract::duration('operation_retention_seconds')),
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
            $existing = RelayOperationModel::query()
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
                throw new RelayDomainException('operation_admission_failed', 500);
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
        $limit = min((int) $payload['limit'], RelayContract::limit('claim_batch'));
        $connection = DB::connection(RelayTablesMaps::connection());

        $this->devices->activeDevice($deviceId);
        RelayContract::assertSameDigest(
            (string) $payload['contract_digest'],
            ['device_id' => $deviceId]
        );

        return $connection->transaction(function () use ($deviceId, $leaseOwner, $limit): array {
            $activeLeases = RelayOperationModel::query()
                ->where('device_id', $deviceId)
                ->whereIn('state', [RelayConstants::STATE_LEASED, RelayConstants::STATE_EXECUTING])
                ->where('lease_expires_at', '>', now())
                ->count();
            $capacity = max(0, RelayContract::limit('device_active_leases') - $activeLeases);
            $rows = collect();
            $operations = [];
            $leaseExpiresAt = now()->addSeconds(RelayContract::duration('operation_lease_seconds'));

            if ($capacity === 0 || $limit < 1) {
                return ['operations' => []];
            }
            $rows = RelayOperationModel::query()
                ->where('device_id', $deviceId)
                ->where('expires_at', '>', now())
                ->where(static function ($query): void {
                    $query->where('state', RelayConstants::STATE_ACCEPTED)
                        ->orWhere('state', RelayConstants::STATE_CANCEL_REQUESTED)
                        ->orWhere(static function ($expired): void {
                            $expired->whereIn('state', [RelayConstants::STATE_LEASED, RelayConstants::STATE_EXECUTING])
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
                if ((string) $operation->state === RelayConstants::STATE_EXECUTING
                    && (string) $operation->retry_policy === RelayConstants::RETRY_AT_MOST_ONCE) {
                    $this->transitionExpiredExecutionToUnknown($operation);
                    continue;
                }
                if ((string) $operation->state !== RelayConstants::STATE_CANCEL_REQUESTED) {
                    $operation->state = RelayConstants::STATE_LEASED;
                    $operation->revision = (int) $operation->revision + 1;
                }
                $operation->claim_epoch = (int) $operation->claim_epoch + 1;
                $operation->attempt = (int) $operation->attempt + 1;
                $operation->lease_owner = $leaseOwner;
                $operation->lease_expires_at = $leaseExpiresAt;
                $operation->updated_at = now();
                $operation->save();
                if ((string) $operation->state === RelayConstants::STATE_LEASED) {
                    $this->events->status($operation);
                }
                $operations[] = $this->claimDescriptor($operation);
            }

            return ['operations' => $operations];
        }, 3);
    }

    public function executionStart(string $deviceId, string $operationId, array $payload): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($deviceId, $operationId, $payload): array {
            $operation = $this->lockedDeviceOperation($deviceId, $operationId);
            $requestRevision = (int) $payload['operation_revision'];
            $epoch = (int) $payload['claim_epoch'];
            $leaseOwner = (string) $payload['lease_owner'];

            $this->assertClaimIdentity($operation, $epoch, $leaseOwner);
            if (!hash_equals((string) $operation->request_digest, (string) $payload['request_digest'])
                || !hash_equals((string) $operation->retry_policy, (string) $payload['retry_policy'])) {
                throw new RelayDomainException('execution_start_conflict', 409);
            }
            if ((string) $operation->state === RelayConstants::STATE_EXECUTING
                && ($requestRevision === (int) $operation->revision
                    || $requestRevision + 1 === (int) $operation->revision)) {
                $this->events->status($operation);
                return ['operation' => $this->leaseDescriptor($operation)];
            }
            if ((string) $operation->state !== RelayConstants::STATE_LEASED
                || $requestRevision !== (int) $operation->revision
                || $operation->lease_expires_at === null
                || $operation->lease_expires_at->lte(now())) {
                throw new RelayDomainException('execution_start_stale', 409);
            }
            $operation->forceFill([
                'state' => RelayConstants::STATE_EXECUTING,
                'revision' => (int) $operation->revision + 1,
                'execution_started_at' => $operation->execution_started_at ?? now(),
                'lease_expires_at' => now()->addSeconds(RelayContract::duration('operation_lease_seconds')),
                'updated_at' => now(),
            ])->save();
            $this->events->status($operation);

            return ['operation' => $this->leaseDescriptor($operation)];
        }, 3);
    }

    public function renewLease(string $deviceId, string $operationId, array $payload): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($deviceId, $operationId, $payload): array {
            $operation = $this->lockedDeviceOperation($deviceId, $operationId);

            $this->assertClaimIdentity($operation, (int) $payload['claim_epoch'], (string) $payload['lease_owner']);
            if ((string) $operation->state !== RelayConstants::STATE_EXECUTING
                || (int) $operation->revision !== (int) $payload['operation_revision']
                || $operation->lease_expires_at === null
                || $operation->lease_expires_at->lte(now())) {
                throw new RelayDomainException('lease_renewal_stale', 409);
            }
            $operation->forceFill([
                'lease_expires_at' => now()->addSeconds(RelayContract::duration('operation_lease_seconds')),
                'updated_at' => now(),
            ])->save();

            return ['operation' => $this->leaseDescriptor($operation)];
        }, 3);
    }

    public function submitResult(string $deviceId, string $operationId, array $payload): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($deviceId, $operationId, $payload): array {
            $operation = $this->lockedDeviceOperation($deviceId, $operationId);
            $outcome = (string) $payload['outcome'];
            $status = array_key_exists('status', $payload) ? (int) $payload['status'] : null;
            $headers = RelayContract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'response');
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
                throw new RelayDomainException('operation_revision_conflict', 409);
            }
            $this->assertResultTransition($operation, $outcome);
            if ($bodyPresent && ($bodyBase64 === null) === ($bodyRef === '')) {
                throw new RelayDomainException('response_body_source_invalid', 422);
            }
            if (!$bodyPresent && ($bodyBase64 !== null || $bodyRef !== '')) {
                throw new RelayDomainException('response_body_unexpected', 422);
            }
            if ($bodyBase64 !== null) {
                $bodyBytes = base64_decode((string) $bodyBase64, true);
                if (!is_string($bodyBytes)
                    || strlen($bodyBytes) > RelayContract::limit('inline_body_bytes')) {
                    throw new RelayDomainException('response_body_base64_invalid', 422);
                }
            }
            if ($bodyRef !== '') {
                $responseBlob = $this->responseBlob($operation, $bodyRef, true);
                if ((int) $responseBlob->final_length !== $bodyLength
                    || !hash_equals((string) $responseBlob->final_sha256, $bodySha256)) {
                    throw new RelayDomainException('response_blob_digest_conflict', 409);
                }
            } elseif (strlen($bodyBytes) !== $bodyLength
                || !hash_equals(hash('sha256', $bodyBytes), $bodySha256)) {
                throw new RelayDomainException('response_body_digest_conflict', 409);
            }
            if ($bodyLength < 0 || $bodyLength > RelayContract::limit('response_body_bytes')) {
                throw new RelayDomainException('response_body_too_large', 413);
            }
            if (in_array($outcome, [RelayConstants::STATE_RESPONDED, RelayConstants::STATE_FAILED], true)
                && (string) $operation->state === RelayConstants::STATE_EXECUTING) {
                if ($status === null || $status < 100 || $status > 599) {
                    throw new RelayDomainException('response_status_invalid', 422);
                }
                $expectedResultDigest = RelayContract::resultDigest($status, $headers, $bodyPresent, $bodySha256, $bodyLength);
                if (!hash_equals($expectedResultDigest, $resultDigest)) {
                    throw new RelayDomainException('result_digest_conflict', 409);
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
        $operation = RelayOperationModel::query()
            ->where('operation_id', $operationId)
            ->where('user_id', $userId)
            ->first();

        if ($operation === null) {
            throw new RelayDomainException('operation_not_found', 404);
        }

        return ['operation' => $this->ownerDescriptor($operation)];
    }

    public function cancel(int $userId, string $operationId): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($userId, $operationId): array {
            $operation = RelayOperationModel::query()
                ->where('operation_id', $operationId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();

            if ($operation === null) {
                throw new RelayDomainException('operation_not_found', 404);
            }
            if (in_array((string) $operation->state, $this->terminalStates(), true)
                || (string) $operation->state === RelayConstants::STATE_CANCEL_REQUESTED) {
                if ((string) $operation->state === RelayConstants::STATE_CANCEL_REQUESTED) {
                    $this->events->wake($operation);
                }
                $this->events->status($operation);
                return ['operation' => $this->ownerDescriptor($operation)];
            }
            if (!RelayContract::transitionAllowed((string) $operation->state, RelayConstants::STATE_CANCEL_REQUESTED)) {
                throw new RelayDomainException('operation_transition_invalid', 409);
            }
            $operation->forceFill([
                'state' => RelayConstants::STATE_CANCEL_REQUESTED,
                'revision' => (int) $operation->revision + 1,
                'updated_at' => now(),
            ])->save();
            $this->events->wake($operation);
            $this->events->status($operation);

            return ['operation' => $this->ownerDescriptor($operation)];
        }, 3);
    }

    public function requestBlob(string $deviceId, string $blobId): RelayBlobModel
    {
        $blob = RelayBlobModel::query()
            ->where('blob_id', $blobId)
            ->where('device_id', $deviceId)
            ->where('direction', RelayConstants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayDomainException('request_blob_not_found', 404);
        }

        return $blob;
    }

    private function validatePayloadProfile(string $profile, bool $bodyPresent, string $bodyBytes, string $bodyRef): void
    {
        $decoded = null;

        if ($profile !== 'json-object') {
            return;
        }
        if (!$bodyPresent || $bodyBytes === '') {
            return;
        }
        if ($bodyRef !== '') {
            return;
        }
        $decoded = json_decode($bodyBytes, true);
        if (!is_array($decoded) || ($decoded !== [] && array_is_list($decoded))) {
            throw new RelayDomainException('route_payload_invalid', 422);
        }
    }

    private function resolveAdmissionDuplicate(
        RelayOperationModel $operation,
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
            throw new RelayDomainException('idempotency_conflict', 409);
        }
        if (in_array((string) $operation->state, [
            RelayConstants::STATE_ACCEPTED,
            RelayConstants::STATE_CANCEL_REQUESTED,
        ], true)) {
            $this->events->wake($operation);
        }
        $this->events->status($operation);

        return $this->ownerDescriptor($operation);
    }

    private function pairingStillActive(RelayOperationModel $operation): bool
    {
        return $this->pairings->isActiveForDevice(
            (int) $operation->user_id,
            (string) $operation->pairing_id,
            (string) $operation->device_id
        );
    }

    private function expireUnclaimable(RelayOperationModel $operation): void
    {
        $target = (string) $operation->state === RelayConstants::STATE_EXECUTING
            ? RelayConstants::STATE_EXECUTION_UNKNOWN
            : RelayConstants::STATE_EXPIRED;

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

    private function transitionExpiredExecutionToUnknown(RelayOperationModel $operation): void
    {
        $operation->forceFill([
            'state' => RelayConstants::STATE_EXECUTION_UNKNOWN,
            'revision' => (int) $operation->revision + 1,
            'error_code' => 'execution_lease_expired',
            'completed_at' => now(),
            'lease_expires_at' => null,
            'updated_at' => now(),
        ])->save();
        $this->events->status($operation);
    }

    private function lockedDeviceOperation(string $deviceId, string $operationId): RelayOperationModel
    {
        $operation = RelayOperationModel::query()
            ->where('operation_id', $operationId)
            ->where('device_id', $deviceId)
            ->lockForUpdate()
            ->first();

        if ($operation === null) {
            throw new RelayDomainException('operation_not_found', 404);
        }

        return $operation;
    }

    private function assertClaimIdentity(RelayOperationModel $operation, int $epoch, string $leaseOwner): void
    {
        if ($epoch < 1
            || $leaseOwner === ''
            || (int) $operation->claim_epoch !== $epoch
            || !hash_equals((string) $operation->lease_owner, $leaseOwner)) {
            throw new RelayDomainException('operation_claim_stale', 409);
        }
    }

    private function assertResultTransition(RelayOperationModel $operation, string $outcome): void
    {
        $state = (string) $operation->state;
        $allowed = [];

        if ($state === RelayConstants::STATE_EXECUTING) {
            $allowed = [RelayConstants::STATE_RESPONDED, RelayConstants::STATE_FAILED, RelayConstants::STATE_EXECUTION_UNKNOWN];
        } elseif (in_array($state, [RelayConstants::STATE_LEASED, RelayConstants::STATE_CANCEL_REQUESTED], true)) {
            $allowed = [RelayConstants::STATE_FAILED, RelayConstants::STATE_CANCELED, RelayConstants::STATE_EXPIRED];
        }
        if (!in_array($outcome, $allowed, true)) {
            throw new RelayDomainException('operation_result_transition_invalid', 409);
        }
    }

    private function responseBlob(RelayOperationModel $operation, string $blobId, bool $finalized): RelayBlobModel
    {
        $query = RelayBlobModel::query()
            ->where('blob_id', $blobId)
            ->where('operation_id', (string) $operation->operation_id)
            ->where('owner_user_id', (int) $operation->user_id)
            ->where('device_id', (string) $operation->device_id)
            ->where('pairing_id', (string) $operation->pairing_id)
            ->where('direction', RelayConstants::BLOB_RESPONSE)
            ->where('expires_at', '>', now());

        if ($finalized) {
            $query->whereNotNull('finalized_at');
        }
        $blob = $query->lockForUpdate()->first();
        if ($blob === null) {
            throw new RelayDomainException('response_blob_not_found', 404);
        }
        if ((int) $blob->operation_revision !== (int) $operation->revision
            || (int) $blob->claim_epoch !== (int) $operation->claim_epoch
            || !hash_equals((string) $blob->lease_owner, (string) $operation->lease_owner)) {
            throw new RelayDomainException('blob_claim_stale', 409);
        }

        return $blob;
    }

    private function resolveResultDuplicate(RelayOperationModel $operation, array $payload): array
    {
        $outcome = (string) $payload['outcome'];
        $resultDigest = strtolower((string) ($payload['result_digest'] ?? ''));
        $bodySha256 = strtolower((string) $payload['body_sha256']);
        $status = array_key_exists('status', $payload) ? (int) $payload['status'] : null;
        $bodyPresent = (bool) $payload['body_present'];
        $bodyBase64 = array_key_exists('body_base64', $payload) ? (string) ($payload['body_base64'] ?? '') : null;
        $bodyRef = trim((string) ($payload['body_ref'] ?? ''));
        $headers = RelayContract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'response');
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
                RelayContract::canonicalJson($operation->response_headers ?? []),
                RelayContract::canonicalJson($headers)
            )
            || (bool) $operation->response_body_present !== $bodyPresent
            || $operation->response_body_base64 !== $bodyBase64
            || $operation->response_blob_id !== ($bodyRef !== '' ? $bodyRef : null)
            || $operation->error_code !== $errorCode) {
            throw new RelayDomainException('operation_result_conflict', 409);
        }

        return $this->ownerDescriptor($operation);
    }

    private function claimDescriptor(RelayOperationModel $operation): array
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

    private function leaseDescriptor(RelayOperationModel $operation): array
    {
        return [
            'state' => (string) $operation->state,
            'revision' => (int) $operation->revision,
            'claim_epoch' => (int) $operation->claim_epoch,
            'server_time' => now()->toIso8601String(),
            'lease_expires_at' => $operation->lease_expires_at?->toIso8601String(),
        ];
    }

    private function ownerDescriptor(RelayOperationModel $operation): array
    {
        return $operation->ownerDescriptor();
    }

    private function terminalStates(): array
    {
        return [
            RelayConstants::STATE_RESPONDED,
            RelayConstants::STATE_FAILED,
            RelayConstants::STATE_EXECUTION_UNKNOWN,
            RelayConstants::STATE_EXPIRED,
            RelayConstants::STATE_CANCELED,
        ];
    }
}
