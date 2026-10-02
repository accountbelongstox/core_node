<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayBlobChunkModel;
use App\Apps\Relay\RelayModels\RelayBlobModel;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use App\Models\User;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayBlobService
{
    public function __construct(private readonly RelayPairingService $pairings)
    {
    }

    public function allocateRequest(int $userId, array $payload): array
    {
        $blobId = (string) $payload['blob_id'];
        $pairingId = (string) $payload['pairing_id'];
        $expectedSha256 = strtolower((string) $payload['expected_sha256']);
        $expectedLength = (int) $payload['expected_length'];
        $connection = DB::connection(RelayTablesMaps::connection());

        $this->assertExpectedMetadata($expectedSha256, $expectedLength, 'request_body_bytes');

        return $connection->transaction(function () use ($userId, $blobId, $pairingId, $expectedSha256, $expectedLength): array {
            $lockedUser = User::query()->whereKey($userId)->lockForUpdate()->first();
            $pairing = $this->pairings->requireActive($userId, $pairingId, true);
            $blob = null;

            if ($lockedUser === null) {
                throw new RelayDomainException('authentication_required', 401);
            }
            $blob = RelayBlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            if ($blob !== null) {
                $this->assertAllocationDuplicate(
                    $blob,
                    $userId,
                    (string) $pairing->device_id,
                    $pairingId,
                    RelayConstants::BLOB_REQUEST,
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
            RelayBlobModel::query()->insertOrIgnore([[
                'blob_id' => $blobId,
                'owner_user_id' => $userId,
                'device_id' => (string) $pairing->device_id,
                'pairing_id' => $pairingId,
                'operation_id' => null,
                'direction' => RelayConstants::BLOB_REQUEST,
                'expected_sha256' => $expectedSha256,
                'expected_length' => $expectedLength,
                'received_chunk_count' => 0,
                'received_length' => 0,
                'expires_at' => now()->addSeconds(RelayContract::duration('blob_retention_seconds')),
                'revision' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
            $blob = RelayBlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            if ($blob === null) {
                throw new RelayDomainException('blob_allocation_conflict', 409);
            }

            return ['blob' => $this->descriptor($blob)];
        }, 3);
    }

    public function allocateResponse(string $deviceId, array $payload): array
    {
        $blobId = (string) $payload['blob_id'];
        $operationId = (string) $payload['operation_id'];
        $pairingId = (string) $payload['pairing_id'];
        $expectedSha256 = strtolower((string) $payload['expected_sha256']);
        $expectedLength = (int) $payload['expected_length'];
        $connection = DB::connection(RelayTablesMaps::connection());
        $pairingSnapshot = RelayPairingModel::query()
            ->where('pairing_id', $pairingId)
            ->where('device_id', $deviceId)
            ->first();
        $userId = (int) ($pairingSnapshot?->user_id ?? 0);

        $this->assertExpectedMetadata($expectedSha256, $expectedLength, 'response_body_bytes');
        if ($userId < 1 || !$this->pairings->isActiveForDevice($userId, $pairingId, $deviceId)) {
            throw new RelayDomainException('pairing_not_found', 404);
        }

        return $connection->transaction(function () use (
            $deviceId,
            $blobId,
            $operationId,
            $pairingId,
            $expectedSha256,
            $expectedLength,
            $userId
        ): array {
            $lockedUser = User::query()->whereKey($userId)->lockForUpdate()->first();
            $blob = RelayBlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();

            if ($lockedUser === null) {
                throw new RelayDomainException('authentication_required', 401);
            }
            if ($blob === null) {
                $this->assertOwnerQuota($userId, $expectedLength);
                // insertOrIgnore keeps the allocation atomic against a
                // concurrent identical allocate (same blob_id): the row is
                // re-read under the lock and either reused or rejected with a
                // domain 409 instead of an uncaught SQLSTATE 23505.
                RelayBlobModel::query()->insertOrIgnore([[
                    'blob_id' => $blobId,
                    'owner_user_id' => $userId,
                    'device_id' => $deviceId,
                    'pairing_id' => $pairingId,
                    'operation_id' => $operationId,
                    'direction' => RelayConstants::BLOB_RESPONSE,
                    'expected_sha256' => $expectedSha256,
                    'expected_length' => $expectedLength,
                    'received_chunk_count' => 0,
                    'received_length' => 0,
                    'expires_at' => now()->addSeconds(RelayContract::duration('blob_retention_seconds')),
                    'revision' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]]);
                $blob = RelayBlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
                if ($blob === null) {
                    throw new RelayDomainException('blob_allocation_conflict', 409);
                }

                return ['blob' => $this->descriptor($blob)];
            }
            $this->assertAllocationDuplicate(
                $blob,
                $userId,
                $deviceId,
                $pairingId,
                RelayConstants::BLOB_RESPONSE,
                $expectedSha256,
                $expectedLength
            );

            return ['blob' => $this->descriptor($blob)];
        }, 3);
    }

    public function storeDeviceChunk(string $deviceId, string $blobId, int $chunkIndex, string $bytes): array
    {
        return $this->storeChunk($blobId, $chunkIndex, $bytes, static function (RelayBlobModel $blob) use ($deviceId): void {
            if ((string) $blob->device_id !== $deviceId || (string) $blob->direction !== RelayConstants::BLOB_RESPONSE) {
                throw new RelayDomainException('blob_not_found', 404);
            }
        });
    }

    public function storeOwnerChunk(int $userId, string $blobId, int $chunkIndex, string $bytes): array
    {
        return $this->storeChunk($blobId, $chunkIndex, $bytes, static function (RelayBlobModel $blob) use ($userId): void {
            if ((int) $blob->owner_user_id !== $userId || (string) $blob->direction !== RelayConstants::BLOB_REQUEST) {
                throw new RelayDomainException('blob_not_found', 404);
            }
        });
    }

    public function finalizeDevice(string $deviceId, string $blobId, array $payload): array
    {
        return $this->finalize($blobId, $payload, static function (RelayBlobModel $blob) use ($deviceId): void {
            if ((string) $blob->device_id !== $deviceId || (string) $blob->direction !== RelayConstants::BLOB_RESPONSE) {
                throw new RelayDomainException('blob_not_found', 404);
            }
        });
    }

    public function finalizeOwner(int $userId, string $blobId, array $payload): array
    {
        return $this->finalize($blobId, $payload, static function (RelayBlobModel $blob) use ($userId): void {
            if ((int) $blob->owner_user_id !== $userId || (string) $blob->direction !== RelayConstants::BLOB_REQUEST) {
                throw new RelayDomainException('blob_not_found', 404);
            }
        });
    }

    public function readDeviceRequest(string $deviceId, string $blobId): string
    {
        $blob = RelayBlobModel::query()
            ->where('blob_id', $blobId)
            ->where('device_id', $deviceId)
            ->where('direction', RelayConstants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayDomainException('blob_not_found', 404);
        }

        return $this->readFinalizedBytes($blob);
    }

    /**
     * Finalized request blob an owner may reference from a frame: owned by the
     * owner, bound to the pairing and device, matching the declared digest and
     * length.
     *
     * @return array{final_sha256: string, final_length: int}
     */
    public function requestBlobForFrame(
        int $userId,
        string $blobId,
        string $pairingId,
        string $deviceId,
        string $sha256,
        int $length
    ): array {
        $blob = RelayBlobModel::query()
            ->where('blob_id', $blobId)
            ->where('owner_user_id', $userId)
            ->where('direction', RelayConstants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayDomainException('request_blob_not_found', 404);
        }
        if (!hash_equals((string) $blob->pairing_id, $pairingId)
            || !hash_equals((string) $blob->device_id, $deviceId)) {
            throw new RelayDomainException('request_blob_invalid', 409);
        }
        if (!hash_equals((string) $blob->final_sha256, $sha256) || (int) $blob->final_length !== $length) {
            throw new RelayDomainException('request_body_digest_conflict', 409);
        }

        return ['final_sha256' => (string) $blob->final_sha256, 'final_length' => (int) $blob->final_length];
    }

    public function readOwnerResponse(int $userId, string $blobId): string
    {
        $blob = RelayBlobModel::query()
            ->where('blob_id', $blobId)
            ->where('owner_user_id', $userId)
            ->where('direction', RelayConstants::BLOB_RESPONSE)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayDomainException('blob_not_found', 404);
        }

        return $this->readFinalizedBytes($blob);
    }

    public function readOwnerRequest(int $userId, string $blobId): string
    {
        $blob = RelayBlobModel::query()
            ->where('blob_id', $blobId)
            ->where('owner_user_id', $userId)
            ->where('direction', RelayConstants::BLOB_REQUEST)
            ->whereNotNull('finalized_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($blob === null) {
            throw new RelayDomainException('blob_not_found', 404);
        }

        return $this->readFinalizedBytes($blob);
    }

    private function storeChunk(
        string $blobId,
        int $chunkIndex,
        string $bytes,
        callable $authorize
    ): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());
        $chunkLength = strlen($bytes);
        $chunkSha256 = hash('sha256', $bytes);

        if ($chunkLength > RelayContract::limit('blob_chunk_bytes')) {
            throw new RelayDomainException('blob_chunk_too_large', 413);
        }

        return $connection->transaction(function () use (
            $blobId,
            $chunkIndex,
            $bytes,
            $chunkLength,
            $chunkSha256,
            $authorize
        ): array {
            $blob = RelayBlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            $chunk = null;
            $relativePath = '';
            $absolutePath = '';
            $fileResult = [];
            $inserted = 0;
            $aggregate = null;

            if ($blob === null || $blob->expires_at->lte(now())) {
                throw new RelayDomainException('blob_not_found', 404);
            }
            $authorize($blob);
            if ($blob->finalized_at !== null) {
                $chunk = RelayBlobChunkModel::query()
                    ->where('blob_id', $blobId)
                    ->where('chunk_index', $chunkIndex)
                    ->first();
                $this->assertChunkDuplicate($chunk, $chunkSha256, $chunkLength);

                return ['blob' => $this->descriptor($blob), 'chunk' => $this->chunkDescriptor($chunk)];
            }
            $this->assertChunkShape($blob, $chunkIndex, $chunkLength);
            $chunk = RelayBlobChunkModel::query()
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
                    throw new RelayDomainException('blob_chunk_conflict', 409);
                }

                return FileSystemManager::writePrivateFile($absolutePath, $bytes);
            }, true);
            if (($fileResult['acquired'] ?? false) !== true || ($fileResult['result'] ?? false) !== true) {
                throw new RelayDomainException('blob_chunk_write_failed', 500);
            }
            $inserted = RelayBlobChunkModel::query()->insertOrIgnore([[
                'blob_id' => $blobId,
                'chunk_index' => $chunkIndex,
                'chunk_sha256' => $chunkSha256,
                'chunk_length' => $chunkLength,
                'storage_relative_path' => $relativePath,
                'stored_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
            $chunk = RelayBlobChunkModel::query()
                ->where('blob_id', $blobId)
                ->where('chunk_index', $chunkIndex)
                ->first();
            $this->assertChunkDuplicate($chunk, $chunkSha256, $chunkLength);
            if ($inserted === 1) {
                $aggregate = RelayBlobChunkModel::query()
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

    private function finalize(string $blobId, array $payload, callable $authorize): array
    {
        $expectedSha256 = strtolower((string) $payload['expected_sha256']);
        $expectedLength = (int) $payload['expected_length'];
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($blobId, $expectedSha256, $expectedLength, $authorize): array {
            $blob = RelayBlobModel::query()->where('blob_id', $blobId)->lockForUpdate()->first();
            $chunks = collect();
            $expectedChunkCount = 0;
            $hashContext = null;
            $totalLength = 0;
            $bytes = false;
            $digest = '';

            if ($blob === null || $blob->expires_at->lte(now())) {
                throw new RelayDomainException('blob_not_found', 404);
            }
            $authorize($blob);
            if (!hash_equals((string) $blob->expected_sha256, $expectedSha256)
                || (int) $blob->expected_length !== $expectedLength) {
                throw new RelayDomainException('blob_finalize_metadata_conflict', 409);
            }
            if ($blob->finalized_at !== null) {
                if (!hash_equals((string) $blob->final_sha256, $expectedSha256)
                    || (int) $blob->final_length !== $expectedLength) {
                    throw new RelayDomainException('blob_finalize_conflict', 409);
                }

                return ['blob' => $this->descriptor($blob)];
            }
            $expectedChunkCount = $expectedLength === 0
                ? 0
                : (int) ceil($expectedLength / RelayContract::limit('blob_chunk_bytes'));
            $chunks = RelayBlobChunkModel::query()
                ->where('blob_id', $blobId)
                ->orderBy('chunk_index')
                ->get();
            if ($chunks->count() !== $expectedChunkCount) {
                throw new RelayDomainException('blob_chunks_incomplete', 409);
            }
            $hashContext = hash_init('sha256');
            foreach ($chunks as $expectedIndex => $chunk) {
                if ((int) $chunk->chunk_index !== $expectedIndex) {
                    throw new RelayDomainException('blob_chunks_noncontiguous', 409);
                }
                $bytes = FileSystemManager::readFile($this->absolutePath((string) $chunk->storage_relative_path), false);
                if (!is_string($bytes)
                    || strlen($bytes) !== (int) $chunk->chunk_length
                    || !hash_equals(hash('sha256', $bytes), (string) $chunk->chunk_sha256)) {
                    throw new RelayDomainException('blob_chunk_storage_conflict', 409);
                }
                hash_update($hashContext, $bytes);
                $totalLength += strlen($bytes);
            }
            $digest = hash_final($hashContext);
            if ($totalLength !== $expectedLength || !hash_equals($digest, $expectedSha256)) {
                throw new RelayDomainException('blob_finalize_digest_conflict', 409);
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

    private function readFinalizedBytes(RelayBlobModel $blob): string
    {
        $chunks = RelayBlobChunkModel::query()
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
                throw new RelayDomainException('blob_chunk_storage_conflict', 409);
            }
            $result .= $bytes;
        }
        if (strlen($result) !== (int) $blob->final_length
            || !hash_equals(hash('sha256', $result), (string) $blob->final_sha256)) {
            throw new RelayDomainException('blob_storage_digest_conflict', 409);
        }

        return $result;
    }

    private function assertExpectedMetadata(string $sha256, int $length, string $limitName): void
    {
        if (preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1 || $length < 0) {
            throw new RelayDomainException('blob_metadata_invalid', 422);
        }
        if ($length > RelayContract::limit($limitName)) {
            throw new RelayDomainException('blob_too_large', 413);
        }
    }

    private function assertOwnerQuota(int $userId, int $newLength): void
    {
        $reserved = (int) RelayBlobModel::query()
            ->where('owner_user_id', $userId)
            ->where('expires_at', '>', now())
            ->sum('expected_length');

        if ($reserved + $newLength > RelayContract::limit('owner_blob_bytes')) {
            throw new RelayDomainException('owner_blob_limit', 429);
        }
    }

    private function assertAllocationDuplicate(
        RelayBlobModel $blob,
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
            throw new RelayDomainException('blob_allocation_conflict', 409);
        }
    }

    private function assertChunkShape(RelayBlobModel $blob, int $chunkIndex, int $chunkLength): void
    {
        $chunkSize = RelayContract::limit('blob_chunk_bytes');
        $expectedChunkCount = (int) ceil((int) $blob->expected_length / $chunkSize);
        $expectedLength = $chunkIndex === $expectedChunkCount - 1
            ? (int) $blob->expected_length - ($chunkIndex * $chunkSize)
            : $chunkSize;

        if ($chunkIndex < 0 || $chunkIndex >= $expectedChunkCount || $chunkLength !== $expectedLength) {
            throw new RelayDomainException('blob_chunk_shape_invalid', 422);
        }
    }

    private function assertChunkDuplicate(?RelayBlobChunkModel $chunk, string $sha256, int $length): void
    {
        if ($chunk === null
            || !hash_equals((string) $chunk->chunk_sha256, $sha256)
            || (int) $chunk->chunk_length !== $length) {
            throw new RelayDomainException('blob_chunk_conflict', 409);
        }
    }

    private function absolutePath(string $relativePath): string
    {
        $normalized = str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

        return PathMapper::getLaravelDataDir('relay'.DIRECTORY_SEPARATOR.'private_blobs'.DIRECTORY_SEPARATOR.$normalized);
    }

    private function descriptor(RelayBlobModel $blob): array
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

    private function chunkDescriptor(RelayBlobChunkModel $chunk): array
    {
        return [
            'chunk_index' => (int) $chunk->chunk_index,
            'chunk_sha256' => (string) $chunk->chunk_sha256,
            'chunk_length' => (int) $chunk->chunk_length,
        ];
    }
}
