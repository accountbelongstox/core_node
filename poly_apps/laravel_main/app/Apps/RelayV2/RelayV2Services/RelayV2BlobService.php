<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2BlobChunkModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2BlobModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2OperationModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use App\Models\User;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayV2BlobService
{
    public function __construct(private readonly RelayV2PairingService $pairings)
    {
    }

    public function allocateRequest(int $userId, array $payload): array
    {
        $blobId = (string) $payload['blob_id'];
        $pairingId = (string) $payload['pairing_id'];
        $expectedSha256 = strtolower((string) $payload['expected_sha256']);
        $expectedLength = (int) $payload['expected_length'];
        $connection = DB::connection(RelayV2TablesMaps::connection());

        $this->assertExpectedMetadata($expectedSha256, $expectedLength, 'request_body_bytes');

        return $connection->transaction(function () use ($userId, $blobId, $pairingId, $expectedSha256, $expectedLength): array {
            $lockedUser = User::query()->whereKey($userId)->lockForUpdate()->first();
            $pairing = $this->pairings->requireActive($userId, $pairingId, true);
            $blob = null;

            if ($lockedUser === null) {
                throw new RelayV2DomainException('authentication_required', 401);
            }
            $blob = RelayV2BlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            if ($blob !== null) {
                $this->assertAllocationDuplicate(
                    $blob,
                    $userId,
                    (string) $pairing->device_id,
                    $pairingId,
                    RelayV2Constants::BLOB_REQUEST,
                    $expectedSha256,
                    $expectedLength
                );

                return ['blob' => $this->descriptor($blob)];
            }
            $this->assertOwnerQuota($userId, $expectedLength);
            // insertOrIgnore keeps the allocation atomic against a concurrent
            // identical allocate (same blob_id): the conflicting unique index
            // would otherwise surface as an uncaught SQLSTATE 23505 instead of
            // the domain 409 below.
            RelayV2BlobModel::query()->insertOrIgnore([[
                'blob_id' => $blobId,
                'owner_user_id' => $userId,
                'device_id' => (string) $pairing->device_id,
                'pairing_id' => $pairingId,
                'operation_id' => null,
                'direction' => RelayV2Constants::BLOB_REQUEST,
                'expected_sha256' => $expectedSha256,
                'expected_length' => $expectedLength,
                'received_chunk_count' => 0,
                'received_length' => 0,
                'expires_at' => now()->addSeconds(RelayV2Contract::duration('blob_retention_seconds')),
                'revision' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
            $blob = RelayV2BlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            if ($blob === null) {
                throw new RelayV2DomainException('blob_allocation_conflict', 409);
            }

            return ['blob' => $this->descriptor($blob)];
        }, 3);
    }

    public function allocateResponse(string $deviceId, string $operationId, array $payload): array
    {
        $expectedSha256 = strtolower((string) $payload['expected_sha256']);
        $expectedLength = (int) $payload['expected_length'];
        $operationRevision = (int) $payload['operation_revision'];
        $claimEpoch = (int) $payload['claim_epoch'];
        $leaseOwner = (string) $payload['lease_owner'];
        $connection = DB::connection(RelayV2TablesMaps::connection());
        $operationSnapshot = RelayV2OperationModel::query()
            ->where('operation_id', $operationId)
            ->where('device_id', $deviceId)
            ->first();
        $userId = (int) ($operationSnapshot?->user_id ?? 0);

        $this->assertExpectedMetadata($expectedSha256, $expectedLength, 'response_body_bytes');
        if ($userId < 1) {
            throw new RelayV2DomainException('operation_not_found', 404);
        }

        return $connection->transaction(function () use (
            $deviceId,
            $operationId,
            $expectedSha256,
            $expectedLength,
            $operationRevision,
            $claimEpoch,
            $leaseOwner,
            $userId
        ): array {
            $lockedUser = User::query()->whereKey($userId)->lockForUpdate()->first();
            $operation = $this->lockedExecutingOperation(
                $deviceId,
                $operationId,
                $operationRevision,
                $claimEpoch,
                $leaseOwner
            );
            $blob = RelayV2BlobModel::query()
                ->where('operation_id', $operationId)
                ->where('direction', RelayV2Constants::BLOB_RESPONSE)
                ->where('claim_epoch', $claimEpoch)
                ->lockForUpdate()
                ->first();

            if ($lockedUser === null) {
                throw new RelayV2DomainException('authentication_required', 401);
            }
            if ($blob === null) {
                $this->assertOwnerQuota((int) $operation->user_id, $expectedLength);
                // insertOrIgnore (INSERT ... ON CONFLICT DO NOTHING) keeps the
                // allocation atomic against any concurrent or drifted unique
                // constraint: instead of an uncaught SQLSTATE 23505 (rendered
                // as a code-less HTTP 500), the row is re-read under the lock
                // and either reused (identical identity) or rejected with a
                // domain 409.
                RelayV2BlobModel::query()->insertOrIgnore([[
                    'blob_id' => (string) Str::uuid(),
                    'owner_user_id' => (int) $operation->user_id,
                    'device_id' => $deviceId,
                    'pairing_id' => (string) $operation->pairing_id,
                    'operation_id' => $operationId,
                    'direction' => RelayV2Constants::BLOB_RESPONSE,
                    'operation_revision' => $operationRevision,
                    'claim_epoch' => $claimEpoch,
                    'lease_owner' => $leaseOwner,
                    'expected_sha256' => $expectedSha256,
                    'expected_length' => $expectedLength,
                    'received_chunk_count' => 0,
                    'received_length' => 0,
                    'expires_at' => now()->addSeconds(RelayV2Contract::duration('blob_retention_seconds')),
                    'revision' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]]);
                $blob = RelayV2BlobModel::query()
                    ->where('operation_id', $operationId)
                    ->where('direction', RelayV2Constants::BLOB_RESPONSE)
                    ->where('claim_epoch', $claimEpoch)
                    ->lockForUpdate()
                    ->first();
                if ($blob === null) {
                    throw new RelayV2DomainException('blob_allocation_conflict', 409);
                }

                return ['blob' => $this->descriptor($blob)];
            }
            $this->assertAllocationDuplicate(
                $blob,
                (int) $operation->user_id,
                $deviceId,
                (string) $operation->pairing_id,
                RelayV2Constants::BLOB_RESPONSE,
                $expectedSha256,
                $expectedLength
            );
            $blob->forceFill([
                'operation_revision' => $operationRevision,
                'claim_epoch' => $claimEpoch,
                'lease_owner' => $leaseOwner,
                'updated_at' => now(),
            ])->save();

            return ['blob' => $this->descriptor($blob)];
        }, 3);
    }

    public function storeDeviceChunk(
        string $deviceId,
        string $blobId,
        int $chunkIndex,
        array $generation,
        string $bytes
    ): array
    {
        $snapshot = RelayV2BlobModel::query()->where('blob_id', $blobId)->first();
        $beforeLock = function () use ($snapshot, $deviceId, $generation): void {
            if ($snapshot === null) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
            $this->lockedExecutingOperation(
                $deviceId,
                (string) $snapshot->operation_id,
                (int) $generation['operation_revision'],
                (int) $generation['claim_epoch'],
                (string) $generation['lease_owner']
            );
        };

        return $this->storeChunk($blobId, $chunkIndex, $bytes, function (RelayV2BlobModel $blob) use ($deviceId, $generation): void {
            if ((string) $blob->device_id !== $deviceId || (string) $blob->direction !== RelayV2Constants::BLOB_RESPONSE) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
            $this->assertBlobGeneration($blob, $generation);
        }, $beforeLock);
    }

    public function storeOwnerChunk(int $userId, string $blobId, int $chunkIndex, string $bytes): array
    {
        return $this->storeChunk($blobId, $chunkIndex, $bytes, static function (RelayV2BlobModel $blob) use ($userId): void {
            if ((int) $blob->owner_user_id !== $userId || (string) $blob->direction !== RelayV2Constants::BLOB_REQUEST) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
        });
    }

    public function finalizeDevice(string $deviceId, string $blobId, array $payload): array
    {
        $snapshot = RelayV2BlobModel::query()->where('blob_id', $blobId)->first();
        $beforeLock = function () use ($snapshot, $deviceId, $payload): void {
            if ($snapshot === null) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
            $this->lockedExecutingOperation(
                $deviceId,
                (string) $snapshot->operation_id,
                (int) $payload['operation_revision'],
                (int) $payload['claim_epoch'],
                (string) $payload['lease_owner']
            );
        };

        return $this->finalize($blobId, $payload, function (RelayV2BlobModel $blob) use ($deviceId, $payload): void {
            if ((string) $blob->device_id !== $deviceId || (string) $blob->direction !== RelayV2Constants::BLOB_RESPONSE) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
            if ((int) $blob->operation_revision !== (int) $payload['operation_revision']
                || (int) $blob->claim_epoch !== (int) $payload['claim_epoch']
                || !hash_equals((string) $blob->lease_owner, (string) $payload['lease_owner'])) {
                throw new RelayV2DomainException('blob_claim_stale', 409);
            }
        }, $beforeLock);
    }

    public function finalizeOwner(int $userId, string $blobId, array $payload): array
    {
        return $this->finalize($blobId, $payload, static function (RelayV2BlobModel $blob) use ($userId): void {
            if ((int) $blob->owner_user_id !== $userId || (string) $blob->direction !== RelayV2Constants::BLOB_REQUEST) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
        });
    }

    public function readDeviceRequest(string $deviceId, string $blobId, array $generation): string
    {
        $blob = RelayV2BlobModel::query()
            ->where('blob_id', $blobId)
            ->where('device_id', $deviceId)
            ->where('direction', RelayV2Constants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayV2DomainException('blob_not_found', 404);
        }
        $operation = RelayV2OperationModel::query()
            ->where('operation_id', (string) $blob->operation_id)
            ->where('request_blob_id', $blobId)
            ->where('user_id', (int) $blob->owner_user_id)
            ->where('device_id', $deviceId)
            ->where('pairing_id', (string) $blob->pairing_id)
            ->whereIn('state', [RelayV2Constants::STATE_LEASED, RelayV2Constants::STATE_EXECUTING])
            ->where('revision', (int) $generation['operation_revision'])
            ->where('claim_epoch', (int) $generation['claim_epoch'])
            ->where('lease_owner', (string) $generation['lease_owner'])
            ->where('lease_expires_at', '>', now())
            ->first();
        if ($operation === null) {
            throw new RelayV2DomainException('request_blob_claim_invalid', 409);
        }

        return $this->readFinalizedBytes($blob);
    }

    public function readOwnerResponse(int $userId, string $blobId): string
    {
        $blob = RelayV2BlobModel::query()
            ->where('blob_id', $blobId)
            ->where('owner_user_id', $userId)
            ->where('direction', RelayV2Constants::BLOB_RESPONSE)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayV2DomainException('blob_not_found', 404);
        }

        return $this->readFinalizedBytes($blob);
    }

    public function readOwnerRequest(int $userId, string $blobId): string
    {
        $blob = RelayV2BlobModel::query()
            ->where('blob_id', $blobId)
            ->where('owner_user_id', $userId)
            ->where('direction', RelayV2Constants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayV2DomainException('blob_not_found', 404);
        }

        return $this->readFinalizedBytes($blob);
    }

    private function storeChunk(
        string $blobId,
        int $chunkIndex,
        string $bytes,
        callable $authorize,
        ?callable $beforeLock = null
    ): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());
        $chunkLength = strlen($bytes);
        $chunkSha256 = hash('sha256', $bytes);

        if ($chunkLength > RelayV2Contract::limit('blob_chunk_bytes')) {
            throw new RelayV2DomainException('blob_chunk_too_large', 413);
        }

        return $connection->transaction(function () use (
            $blobId,
            $chunkIndex,
            $bytes,
            $chunkLength,
            $chunkSha256,
            $authorize,
            $beforeLock
        ): array {
            if ($beforeLock !== null) {
                $beforeLock();
            }
            $blob = RelayV2BlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            $chunk = null;
            $relativePath = '';
            $absolutePath = '';
            $fileResult = [];
            $inserted = 0;
            $aggregate = null;

            if ($blob === null || $blob->expires_at->lte(now())) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
            $authorize($blob);
            if ($blob->finalized_at !== null) {
                $chunk = RelayV2BlobChunkModel::query()
                    ->where('blob_id', $blobId)
                    ->where('chunk_index', $chunkIndex)
                    ->first();
                $this->assertChunkDuplicate($chunk, $chunkSha256, $chunkLength);

                return ['blob' => $this->descriptor($blob), 'chunk' => $this->chunkDescriptor($chunk)];
            }
            $this->assertChunkShape($blob, $chunkIndex, $chunkLength);
            $chunk = RelayV2BlobChunkModel::query()
                ->where('blob_id', $blobId)
                ->where('chunk_index', $chunkIndex)
                ->first();
            if ($chunk !== null) {
                $this->assertChunkDuplicate($chunk, $chunkSha256, $chunkLength);

                return ['blob' => $this->descriptor($blob), 'chunk' => $this->chunkDescriptor($chunk)];
            }
            $relativePath = $blobId.'/'.$chunkIndex.'.chunk';
            $absolutePath = $this->absolutePath($relativePath);
            $fileResult = FileSystemManager::runWithExclusiveFileLock($absolutePath, function () use ($absolutePath, $bytes, $chunkSha256): bool {
                $existingBytes = FileSystemManager::readFile($absolutePath, false);

                if (is_string($existingBytes) && hash_equals(hash('sha256', $existingBytes), $chunkSha256)) {
                    return true;
                }
                if (is_string($existingBytes) && $existingBytes !== '') {
                    throw new RelayV2DomainException('blob_chunk_conflict', 409);
                }

                return FileSystemManager::writePrivateFile($absolutePath, $bytes);
            }, true);
            if (($fileResult['acquired'] ?? false) !== true || ($fileResult['result'] ?? false) !== true) {
                throw new RelayV2DomainException('blob_chunk_write_failed', 500);
            }
            $inserted = RelayV2BlobChunkModel::query()->insertOrIgnore([[
                'blob_id' => $blobId,
                'chunk_index' => $chunkIndex,
                'chunk_sha256' => $chunkSha256,
                'chunk_length' => $chunkLength,
                'storage_relative_path' => $relativePath,
                'stored_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
            $chunk = RelayV2BlobChunkModel::query()
                ->where('blob_id', $blobId)
                ->where('chunk_index', $chunkIndex)
                ->first();
            $this->assertChunkDuplicate($chunk, $chunkSha256, $chunkLength);
            if ($inserted === 1) {
                $aggregate = RelayV2BlobChunkModel::query()
                    ->where('blob_id', $blobId)
                    ->selectRaw('COUNT(*) AS chunk_count, COALESCE(SUM(chunk_length), 0) AS byte_count')
                    ->first();
                $blob->forceFill([
                    'received_chunk_count' => (int) ($aggregate?->chunk_count ?? 0),
                    'received_length' => (int) ($aggregate?->byte_count ?? 0),
                    'revision' => (int) $blob->revision + 1,
                    'updated_at' => now(),
                ])->save();
            }

            return ['blob' => $this->descriptor($blob), 'chunk' => $this->chunkDescriptor($chunk)];
        }, 3);
    }

    private function finalize(string $blobId, array $payload, callable $authorize, ?callable $beforeLock = null): array
    {
        $expectedSha256 = strtolower((string) $payload['expected_sha256']);
        $expectedLength = (int) $payload['expected_length'];
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($blobId, $expectedSha256, $expectedLength, $authorize, $beforeLock): array {
            if ($beforeLock !== null) {
                $beforeLock();
            }
            $blob = RelayV2BlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            $chunks = collect();
            $expectedChunkCount = 0;
            $hashContext = null;
            $totalLength = 0;
            $bytes = false;
            $digest = '';

            if ($blob === null || $blob->expires_at->lte(now())) {
                throw new RelayV2DomainException('blob_not_found', 404);
            }
            $authorize($blob);
            if (!hash_equals((string) $blob->expected_sha256, $expectedSha256)
                || (int) $blob->expected_length !== $expectedLength) {
                throw new RelayV2DomainException('blob_finalize_metadata_conflict', 409);
            }
            if ($blob->finalized_at !== null) {
                if (!hash_equals((string) $blob->final_sha256, $expectedSha256)
                    || (int) $blob->final_length !== $expectedLength) {
                    throw new RelayV2DomainException('blob_finalize_conflict', 409);
                }

                return ['blob' => $this->descriptor($blob)];
            }
            $expectedChunkCount = $expectedLength === 0
                ? 0
                : (int) ceil($expectedLength / RelayV2Contract::limit('blob_chunk_bytes'));
            $chunks = RelayV2BlobChunkModel::query()
                ->where('blob_id', $blobId)
                ->orderBy('chunk_index')
                ->get();
            if ($chunks->count() !== $expectedChunkCount) {
                throw new RelayV2DomainException('blob_chunks_incomplete', 409);
            }
            $hashContext = hash_init('sha256');
            foreach ($chunks as $expectedIndex => $chunk) {
                if ((int) $chunk->chunk_index !== $expectedIndex) {
                    throw new RelayV2DomainException('blob_chunks_noncontiguous', 409);
                }
                $bytes = FileSystemManager::readFile($this->absolutePath((string) $chunk->storage_relative_path), false);
                if (!is_string($bytes)
                    || strlen($bytes) !== (int) $chunk->chunk_length
                    || !hash_equals(hash('sha256', $bytes), (string) $chunk->chunk_sha256)) {
                    throw new RelayV2DomainException('blob_chunk_storage_conflict', 409);
                }
                hash_update($hashContext, $bytes);
                $totalLength += strlen($bytes);
            }
            $digest = hash_final($hashContext);
            if ($totalLength !== $expectedLength || !hash_equals($digest, $expectedSha256)) {
                throw new RelayV2DomainException('blob_finalize_digest_conflict', 409);
            }
            $blob->forceFill([
                'final_sha256' => $digest,
                'final_length' => $totalLength,
                'finalized_at' => now(),
                'revision' => (int) $blob->revision + 1,
                'updated_at' => now(),
            ])->save();

            return ['blob' => $this->descriptor($blob)];
        }, 3);
    }

    private function readFinalizedBytes(RelayV2BlobModel $blob): string
    {
        $chunks = RelayV2BlobChunkModel::query()
            ->where('blob_id', (string) $blob->blob_id)
            ->orderBy('chunk_index')
            ->get();
        $result = '';
        $bytes = false;

        foreach ($chunks as $chunk) {
            $bytes = FileSystemManager::readFile($this->absolutePath((string) $chunk->storage_relative_path), false);
            if (!is_string($bytes)
                || strlen($bytes) !== (int) $chunk->chunk_length
                || !hash_equals(hash('sha256', $bytes), (string) $chunk->chunk_sha256)) {
                throw new RelayV2DomainException('blob_chunk_storage_conflict', 409);
            }
            $result .= $bytes;
        }
        if (strlen($result) !== (int) $blob->final_length
            || !hash_equals(hash('sha256', $result), (string) $blob->final_sha256)) {
            throw new RelayV2DomainException('blob_storage_digest_conflict', 409);
        }

        return $result;
    }

    private function lockedExecutingOperation(
        string $deviceId,
        string $operationId,
        int $operationRevision,
        int $claimEpoch,
        string $leaseOwner
    ): RelayV2OperationModel {
        $operation = RelayV2OperationModel::query()
            ->where('operation_id', $operationId)
            ->where('device_id', $deviceId)
            ->lockForUpdate()
            ->first();

        if ($operation === null) {
            throw new RelayV2DomainException('operation_not_found', 404);
        }
        if ((string) $operation->state !== RelayV2Constants::STATE_EXECUTING
            || (int) $operation->revision !== $operationRevision
            || (int) $operation->claim_epoch !== $claimEpoch
            || !hash_equals((string) $operation->lease_owner, $leaseOwner)
            || $operation->lease_expires_at === null
            || $operation->lease_expires_at->lte(now())) {
            throw new RelayV2DomainException('blob_claim_stale', 409);
        }

        return $operation;
    }

    private function assertBlobGeneration(RelayV2BlobModel $blob, array $generation): void
    {
        if ((int) $blob->operation_revision !== (int) $generation['operation_revision']
            || (int) $blob->claim_epoch !== (int) $generation['claim_epoch']
            || !hash_equals((string) $blob->lease_owner, (string) $generation['lease_owner'])) {
            throw new RelayV2DomainException('blob_claim_stale', 409);
        }
    }

    private function assertExpectedMetadata(string $sha256, int $length, string $limitName): void
    {
        if (preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1 || $length < 0) {
            throw new RelayV2DomainException('blob_metadata_invalid', 422);
        }
        if ($length > RelayV2Contract::limit($limitName)) {
            throw new RelayV2DomainException('blob_too_large', 413);
        }
    }

    private function assertOwnerQuota(int $userId, int $newLength): void
    {
        $reserved = (int) RelayV2BlobModel::query()
            ->where('owner_user_id', $userId)
            ->where('expires_at', '>', now())
            ->sum('expected_length');

        if ($reserved + $newLength > RelayV2Contract::limit('owner_blob_bytes')) {
            throw new RelayV2DomainException('owner_blob_limit', 429);
        }
    }

    private function assertAllocationDuplicate(
        RelayV2BlobModel $blob,
        int $userId,
        string $deviceId,
        string $pairingId,
        string $direction,
        string $sha256,
        int $length
    ): void {
        if ((int) $blob->owner_user_id !== $userId
            || !hash_equals((string) $blob->device_id, $deviceId)
            || !hash_equals((string) $blob->pairing_id, $pairingId)
            || (string) $blob->direction !== $direction
            || !hash_equals((string) $blob->expected_sha256, $sha256)
            || (int) $blob->expected_length !== $length) {
            throw new RelayV2DomainException('blob_allocation_conflict', 409);
        }
    }

    private function assertChunkShape(RelayV2BlobModel $blob, int $chunkIndex, int $chunkLength): void
    {
        $chunkSize = RelayV2Contract::limit('blob_chunk_bytes');
        $expectedChunkCount = (int) ceil((int) $blob->expected_length / $chunkSize);
        $expectedLength = $chunkIndex === $expectedChunkCount - 1
            ? (int) $blob->expected_length - ($chunkIndex * $chunkSize)
            : $chunkSize;

        if ($chunkIndex < 0 || $chunkIndex >= $expectedChunkCount || $chunkLength !== $expectedLength) {
            throw new RelayV2DomainException('blob_chunk_shape_invalid', 422);
        }
    }

    private function assertChunkDuplicate(?RelayV2BlobChunkModel $chunk, string $sha256, int $length): void
    {
        if ($chunk === null
            || !hash_equals((string) $chunk->chunk_sha256, $sha256)
            || (int) $chunk->chunk_length !== $length) {
            throw new RelayV2DomainException('blob_chunk_conflict', 409);
        }
    }

    private function absolutePath(string $relativePath): string
    {
        $normalized = str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

        return PathMapper::getLaravelDataDir('relay_v2'.DIRECTORY_SEPARATOR.'private_blobs'.DIRECTORY_SEPARATOR.$normalized);
    }

    private function descriptor(RelayV2BlobModel $blob): array
    {
        return [
            'blob_id' => (string) $blob->blob_id,
            'direction' => (string) $blob->direction,
            'expected_sha256' => (string) $blob->expected_sha256,
            'expected_length' => (int) $blob->expected_length,
            'received_chunk_count' => (int) $blob->received_chunk_count,
            'received_length' => (int) $blob->received_length,
            'finalized' => $blob->finalized_at !== null,
            'revision' => (int) $blob->revision,
            'expires_at' => $blob->expires_at?->toIso8601String(),
        ];
    }

    private function chunkDescriptor(RelayV2BlobChunkModel $chunk): array
    {
        return [
            'chunk_index' => (int) $chunk->chunk_index,
            'chunk_sha256' => (string) $chunk->chunk_sha256,
            'chunk_length' => (int) $chunk->chunk_length,
        ];
    }
}
