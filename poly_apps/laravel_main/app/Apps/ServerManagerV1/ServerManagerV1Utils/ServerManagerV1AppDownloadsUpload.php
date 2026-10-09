<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Support\ServiceContract;
use App\Utils\FileSystemManager;

/**
 * Resumable chunked upload fallback for ServerManagerV1AppDownloadsSyncJob: a
 * builder that the server cannot reach pushes the manifest's files in
 * sha256-checked chunks into the staging directory, then commits the manifest.
 */
class ServerManagerV1AppDownloadsUpload
{
    /**
     * Append one chunk. Errors carry the offset the client must resume from.
     *
     * @return array{success: bool, error_code?: string, offset: int, size: int, complete: bool, free_bytes?: ?int}
     */
    public static function chunk(string $app, string $file, int $size, string $sha256, int $offset, string $chunkB64, string $chunkSha256): array
    {
        $bytes = base64_decode($chunkB64, true);
        $entry = ['file' => $file, 'size' => $size, 'sha256' => strtolower($sha256)];
        $disk = [];
        $written = [];
        $partPath = '';
        $resume = 0;

        if ($bytes === false || $bytes === '' || strlen($bytes) > ServiceContract::positiveInt('app_downloads.server_sync.upload_chunk_max_bytes')) {
            return self::answer(false, 'chunk_invalid', 0, $size);
        }
        if (!hash_equals(strtolower($chunkSha256), hash('sha256', $bytes))) {
            return self::answer(false, 'chunk_sha256_mismatch', 0, $size);
        }
        if ($size > ServiceContract::positiveInt('app_downloads.server_sync.max_file_bytes')) {
            return self::answer(false, 'file_too_large', 0, $size);
        }
        FileSystemManager::ensureDirectoryExists(ServerManagerV1AppDownloadsStore::stagingDirectory($app));
        if (ServerManagerV1AppDownloadsStore::isStaged($app, $entry)) {
            return self::answer(true, null, $size, $size);
        }
        $partPath = ServerManagerV1AppDownloadsStore::partPath($app, $entry);
        $resume = ServerManagerV1AppDownloadsStore::partialBytes($app, $entry);
        if ($offset !== $resume) {
            return self::answer(false, 'offset_mismatch', $resume, $size);
        }
        $disk = ServerManagerV1AppDownloadsStore::diskCheck($size - $resume);
        if (!$disk['ok']) {
            return self::answer(false, 'insufficient_disk', $resume, $size) + ['free_bytes' => $disk['free']];
        }
        if ($offset + strlen($bytes) > $size) {
            return self::answer(false, 'chunk_invalid', $resume, $size);
        }
        $written = FileSystemManager::writeFileSegment($partPath, $bytes, $offset);
        if (!$written['success']) {
            return self::answer(false, !empty($written['busy']) ? 'upload_busy' : 'offset_mismatch', (int) $written['offset'], $size);
        }
        if ($written['offset'] < $size) {
            return self::answer(true, null, (int) $written['offset'], $size);
        }
        if (!hash_equals(strtolower($sha256), (string) FileSystemManager::hashFile($partPath))) {
            FileSystemManager::delete($partPath);

            return self::answer(false, 'upload_sha256_mismatch', 0, $size);
        }
        if (!FileSystemManager::moveFile($partPath, ServerManagerV1AppDownloadsStore::stagedPath($app, $entry))) {
            return self::answer(false, 'rename_failed', $size, $size);
        }

        return self::answer(true, null, $size, $size);
    }

    /**
     * Publish a manifest from files already staged (or already published).
     *
     * @return array{success: bool, error_code?: string, detail?: mixed, result?: string, fetched?: array, pruned?: array}
     */
    public static function commit(string $app, mixed $rawManifest, ?array $platforms): array
    {
        $normalized = ServerManagerV1AppDownloadsStore::normalizeManifest($app, $rawManifest, ServerManagerV1AppDownloadsStore::platforms($platforms));
        $manifest = [];
        $plan = [];
        $missing = [];
        $published = [];

        if (!isset($normalized['manifest'])) {
            return ['success' => false, 'error_code' => $normalized['error'], 'detail' => $normalized['detail'] ?? ''];
        }
        $manifest = $normalized['manifest'];
        if ($manifest['files'] === []) {
            return ['success' => false, 'error_code' => 'manifest_empty'];
        }
        $plan = ServerManagerV1AppDownloadsStore::plan($app, $manifest, ServerManagerV1AppDownloadsStore::readManifest($app));
        if (ServerManagerV1AppDownloadsStore::isUnchanged($plan)) {
            return ['success' => true, 'result' => 'unchanged', 'fetched' => [], 'pruned' => []];
        }
        foreach ($plan['fetch'] as $file => $entry) {
            if (!ServerManagerV1AppDownloadsStore::isStaged($app, $entry)) {
                $missing[] = $file;
            }
        }
        if ($missing !== []) {
            return ['success' => false, 'error_code' => 'files_missing', 'detail' => $missing];
        }
        $published = ServerManagerV1AppDownloadsStore::publish(
            $app,
            $manifest,
            $plan,
            static fn (array $entry, string $partPath): string => 'files_missing'
        );
        if (isset($published['error'])) {
            return ['success' => false, 'error_code' => $published['error'], 'detail' => $published['detail'] ?? ''];
        }

        return ['success' => true] + $published;
    }

    private static function answer(bool $success, ?string $errorCode, int $offset, int $size): array
    {
        $answer = ['success' => $success, 'offset' => $offset, 'size' => $size, 'complete' => $success && $offset === $size];

        return $errorCode === null ? $answer : $answer + ['error_code' => $errorCode];
    }
}
