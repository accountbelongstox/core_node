<?php

namespace App\Services\Relay;

use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\QueueCenterContract;
use Illuminate\Support\Str;

/**
 * Relay blob store: chunked, disk-backed bodies that exceed the inline cap.
 *
 * Meta lives in the cache store with the request TTL; chunk bytes live under
 * one directory per blob. Chunk and per-request totals are enforced here -
 * the single place both ends trust (contract caps).
 */
final class RelayBlobStore
{
    private const META_KEY = 'relay:blob:%s';

    public static function create(string $machineId, ?string $blobId, int $chunkIndex, bool $last, string $bytes): array
    {
        $chunkCap = QueueCenterContract::relayCap('blob_chunk_bytes');
        $totalCap = QueueCenterContract::relayCap('request_total_bytes');
        $meta = null;
        $id = $blobId ?? 'blob_'.Str::uuid()->toString();

        if (strlen($bytes) > $chunkCap) {
            throw new \InvalidArgumentException('Blob chunk exceeds contract cap.');
        }

        $meta = self::meta($machineId, $id);
        if ($meta === null) {
            $meta = [
                'blob_id' => $id,
                'machine_id' => $machineId,
                'chunks' => 0,
                'received_bytes' => 0,
                'complete' => false,
            ];
        }
        if (($meta['received_bytes'] + strlen($bytes)) > $totalCap) {
            throw new \InvalidArgumentException('Blob total exceeds contract cap.');
        }

        self::writeChunk($id, $chunkIndex, $bytes);
        $meta['chunks'] = (int) $meta['chunks'] + 1;
        $meta['received_bytes'] = (int) $meta['received_bytes'] + strlen($bytes);
        $meta['complete'] = $last;
        self::putMeta($machineId, $id, $meta);

        return $meta;
    }

    public static function meta(string $machineId, string $blobId): ?array
    {
        $meta = QueueCenterCacheStore::get()->get(self::metaKey($machineId, $blobId));

        return is_array($meta) ? $meta : null;
    }

    /**
     * Concatenated blob bytes, or null when incomplete/unknown/expired.
     */
    public static function read(string $machineId, string $blobId): ?string
    {
        $meta = self::meta($machineId, $blobId);
        if ($meta === null || ($meta['complete'] ?? false) !== true) {
            return null;
        }

        $blobDir = self::blobDirectory($blobId);
        $bytes = '';
        $chunkFiles = glob($blobDir.DIRECTORY_SEPARATOR.'*.bin') ?: [];
        sort($chunkFiles, SORT_NATURAL);
        foreach ($chunkFiles as $chunkFile) {
            $chunk = file_get_contents($chunkFile);
            if ($chunk === false) {
                return null;
            }
            $bytes .= $chunk;
        }

        return $bytes;
    }

    private static function writeChunk(string $blobId, int $chunkIndex, string $bytes): void
    {
        $blobDir = self::blobDirectory($blobId);
        if (!is_dir($blobDir)) {
            mkdir($blobDir, 0700, true);
        }
        file_put_contents($blobDir.DIRECTORY_SEPARATOR.str_pad((string) max(0, $chunkIndex), 8, '0', STR_PAD_LEFT).'.bin', $bytes);
    }

    private static function blobDirectory(string $blobId): string
    {
        return storage_path('app'.DIRECTORY_SEPARATOR.'relay'.DIRECTORY_SEPARATOR.'blobs'.DIRECTORY_SEPARATOR.$blobId);
    }

    private static function putMeta(string $machineId, string $blobId, array $meta): void
    {
        QueueCenterCacheStore::get()->put(
            self::metaKey($machineId, $blobId),
            $meta,
            now()->addSeconds(RelayRequestStore::ttlSeconds())
        );
    }

    private static function metaKey(string $machineId, string $blobId): string
    {
        return sprintf(self::META_KEY, $machineId.':'.$blobId);
    }
}
