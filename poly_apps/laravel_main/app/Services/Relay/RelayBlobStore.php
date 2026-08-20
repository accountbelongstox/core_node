<?php

namespace App\Services\Relay;

use App\Providers\PathMapper;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\QueueCenterContract;
use App\Utils\FileSystemManager;
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
        $chunkPath = '';
        $existingChunk = false;
        $meta = null;
        $id = $blobId ?? 'blob_'.Str::uuid()->toString();
        $lastChunkIndex = null;
        $statistics = [];

        if (strlen($bytes) > $chunkCap) {
            throw new \InvalidArgumentException('Blob chunk exceeds contract cap.');
        }
        if (!self::isValidBlobId($id)) {
            throw new \InvalidArgumentException('Invalid blob id.');
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
        $statistics = self::chunkStatistics($machineId, $id);
        $chunkPath = self::chunkPath($machineId, $id, $chunkIndex);
        $existingChunk = FileSystemManager::readFile($chunkPath, false);
        if (is_string($existingChunk) && !hash_equals($existingChunk, $bytes)) {
            throw new \InvalidArgumentException('Blob chunk conflicts with stored content.');
        }
        if (!is_string($existingChunk) && ($statistics['bytes'] + strlen($bytes)) > $totalCap) {
            throw new \InvalidArgumentException('Blob total exceeds contract cap.');
        }

        if (!is_string($existingChunk)) {
            self::writeChunk($chunkPath, $bytes);
        }
        $statistics = self::chunkStatistics($machineId, $id);
        if ($last) {
            $meta['last_chunk_index'] = $chunkIndex;
        }
        $lastChunkIndex = $meta['last_chunk_index'] ?? null;
        $meta['chunks'] = $statistics['chunks'];
        $meta['received_bytes'] = $statistics['bytes'];
        $meta['complete'] = is_int($lastChunkIndex)
            && $statistics['indices'] === range(0, $lastChunkIndex);
        self::putMeta($machineId, $id, $meta);

        return $meta;
    }

    public static function meta(string $machineId, string $blobId): ?array
    {
        if (!self::isValidBlobId($blobId)) {
            return null;
        }
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

        $blobDir = self::blobDirectory($machineId, $blobId);
        $bytes = '';
        $chunkFiles = self::chunkFiles($blobDir);
        sort($chunkFiles, SORT_NATURAL);
        foreach ($chunkFiles as $chunkFile) {
            $chunk = FileSystemManager::readFile($chunkFile, false);
            if (!is_string($chunk)) {
                return null;
            }
            $bytes .= $chunk;
        }

        return $bytes;
    }

    private static function writeChunk(string $chunkPath, string $bytes): void
    {
        $blobDir = dirname($chunkPath);
        $stored = false;

        if (!FileSystemManager::ensureDirectoryExists($blobDir, 0700)) {
            throw new \RuntimeException('Unable to create the relay blob directory.');
        }
        FileSystemManager::writePrivateFile($chunkPath, $bytes);
        $stored = FileSystemManager::readFile($chunkPath, false);
        if (!is_string($stored) || !hash_equals($bytes, $stored)) {
            throw new \RuntimeException('Unable to persist the relay blob chunk.');
        }
    }

    private static function blobDirectory(string $machineId, string $blobId): string
    {
        return PathMapper::getLaravelMainDir().DIRECTORY_SEPARATOR.'storage'
            .DIRECTORY_SEPARATOR.'app'.DIRECTORY_SEPARATOR.'relay'
            .DIRECTORY_SEPARATOR.'blobs'.DIRECTORY_SEPARATOR.hash('sha256', $machineId)
            .DIRECTORY_SEPARATOR.$blobId;
    }

    private static function chunkPath(string $machineId, string $blobId, int $chunkIndex): string
    {
        return self::blobDirectory($machineId, $blobId).DIRECTORY_SEPARATOR
            .str_pad((string) max(0, $chunkIndex), 8, '0', STR_PAD_LEFT).'.bin';
    }

    /**
     * @return array<int, string>
     */
    private static function chunkFiles(string $blobDir): array
    {
        $entries = FileSystemManager::scandir($blobDir);
        $files = [];
        $path = '';

        if (!is_array($entries)) {
            return [];
        }
        foreach ($entries as $entry) {
            $path = $blobDir.DIRECTORY_SEPARATOR.$entry;
            if (preg_match('/^\d{8}\.bin$/', $entry) === 1 && FileSystemManager::isFile($path)) {
                $files[] = $path;
            }
        }

        return $files;
    }

    /**
     * @return array{chunks: int, bytes: int, indices: array<int, int>}
     */
    private static function chunkStatistics(string $machineId, string $blobId): array
    {
        $bytes = 0;
        $files = self::chunkFiles(self::blobDirectory($machineId, $blobId));
        $indices = [];
        $size = false;

        foreach ($files as $file) {
            $size = FileSystemManager::filesize($file);
            if (is_int($size)) {
                $bytes += $size;
            }
            $indices[] = (int) pathinfo($file, PATHINFO_FILENAME);
        }
        sort($indices, SORT_NUMERIC);

        return ['chunks' => count($files), 'bytes' => $bytes, 'indices' => $indices];
    }

    private static function isValidBlobId(string $blobId): bool
    {
        return preg_match('/^blob_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $blobId) === 1;
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
