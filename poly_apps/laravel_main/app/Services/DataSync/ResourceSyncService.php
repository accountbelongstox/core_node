<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use App\Utils\SystemArchiveManager;

final class ResourceSyncService
{
    public const CHUNK_BYTES = 4 * 1024 * 1024;
    public const BATCH_MAX_FILES = 200;
    private const HASH_CACHE_SUBDIR = 'data-sync/manifest-cache';

    public function __construct(private readonly DataSyncArtifactStore $artifacts) {}

    public function roots(): array
    {
        $candidates = [
            'static' => PathMapper::getLaravelStaticDir(),
            'avatars' => PathMapper::getLaravelAvatarsDir(),
            'uploads' => PathMapper::getLaravelUploadsDir(),
            'tts_data' => PathMapper::getTTSDataDir(),
            'app_external_data' => PathMapper::getAppQyV1ExternalDataRoot(),
            'app_qy_v1_word_audio' => PathMapper::getAppQyV1AudioDir(),
            'app_qy_v1_sentence_audio' => PathMapper::getAppQyV1SentenceSoundsDir(),
            'app_qy_v1_word_images' => PathMapper::getAppQyV1WordImagesDir(),
        ];
        $roots = [];
        $coveredPaths = [];

        foreach ($candidates as $key => $path) {
            $normalizedPath = $this->normalizedPath($path);
            foreach ($coveredPaths as $coveredPath) {
                if ($normalizedPath === $coveredPath || str_starts_with($normalizedPath, $coveredPath . '/')) {
                    continue 2;
                }
            }
            $roots[$key] = $path;
            $coveredPaths[] = $normalizedPath;
        }

        return $roots;
    }

    public function root(string $key): string
    {
        return $this->roots()[$key] ?? throw new \InvalidArgumentException("Unknown resource root: {$key}");
    }

    /**
     * Relative path => size + SHA-256, hashing only files whose size or mtime
     * changed since the last scan of this root.
     */
    public function manifest(string $key, ?callable $shouldAbort = null): array
    {
        $root = $this->root($key);
        return [
            'key' => $key,
            'files' => FileSystemManager::fileManifest($root, $shouldAbort, $this->hashCachePath($key, $root)),
        ];
    }

    public function diffManifests(array $sourceManifest, array $targetManifest): array
    {
        $different = [];

        foreach ($sourceManifest as $relativePath => $metadata) {
            $target = $targetManifest[$relativePath] ?? null;
            if (
                !is_array($target)
                || (int) ($target['size'] ?? -1) !== (int) ($metadata['size'] ?? -2)
                || (string) ($target['sha256'] ?? '') !== (string) ($metadata['sha256'] ?? '')
            ) {
                $different[] = (string) $relativePath;
            }
        }

        return $different;
    }

    public function sourceFilePath(string $key, string $relativePath): string
    {
        $relativePath = SystemArchiveManager::sanitizeRelativePath($relativePath);
        return rtrim($this->root($key), '/\\') . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    }

    public function readFileChunk(string $key, string $relativePath, int $offset): array
    {
        $path = $this->sourceFilePath($key, $relativePath);
        $size = FileSystemManager::filesize($path);
        if ($size === false) {
            throw new \RuntimeException("Resource file is missing: {$key}/{$relativePath}");
        }
        $content = FileSystemManager::readFileSegment($path, max(0, $offset), self::CHUNK_BYTES);
        if ($content === false) {
            throw new \RuntimeException("Unable to read the resource file: {$key}/{$relativePath}");
        }
        $nextOffset = $offset + strlen($content);

        return [
            'key' => $key,
            'relative_path' => $relativePath,
            'offset' => $offset,
            'next_offset' => $nextOffset,
            'size' => (int) $size,
            'final' => $nextOffset >= (int) $size,
            'content' => base64_encode($content),
        ];
    }

    /**
     * Whole small files, returned in request order until the byte budget is
     * reached (at least one file is always returned).
     *
     * @param list<array{key:string,relative_path:string}> $items
     */
    public function readFileBatch(array $items): array
    {
        $files = [];
        $bytes = 0;

        foreach (array_slice($items, 0, self::BATCH_MAX_FILES) as $item) {
            $key = (string) ($item['key'] ?? '');
            $relativePath = (string) ($item['relative_path'] ?? '');
            $content = FileSystemManager::readFile($this->sourceFilePath($key, $relativePath), false);
            if ($content === false) {
                throw new \RuntimeException("Unable to read the resource file: {$key}/{$relativePath}");
            }
            if ($files !== [] && $bytes + strlen($content) > self::CHUNK_BYTES) {
                break;
            }
            $bytes += strlen($content);
            $files[] = [
                'key' => $key,
                'relative_path' => $relativePath,
                'sha256' => hash('sha256', $content),
                'content' => base64_encode($content),
            ];
        }

        return ['files' => $files];
    }

    /**
     * Commits one whole file after its SHA-256 matches; a destination that
     * already has the expected hash is left untouched.
     */
    public function commitWholeFile(string $jobId, string $key, string $relativePath, string $content, string $expectedHash): array
    {
        $relativePath = SystemArchiveManager::sanitizeRelativePath($relativePath);
        $destinationPath = $this->sourceFilePath($key, $relativePath);

        if ($this->hasHash($destinationPath, $expectedHash)) {
            return ['complete' => true, 'already_present' => true, 'bytes' => 0];
        }
        if (!hash_equals($expectedHash, hash('sha256', $content))) {
            throw new DataSyncHashMismatchException("{$key}/{$relativePath}");
        }
        $partPath = $this->artifacts->incomingPath($jobId, "files/{$key}/{$relativePath}.part");
        if (!FileSystemManager::writeFile($partPath, $content) || !FileSystemManager::moveFile($partPath, $destinationPath)) {
            throw new \RuntimeException("Unable to move the received resource file into place: {$key}/{$relativePath}");
        }

        return ['complete' => true, 'already_present' => false, 'bytes' => strlen($content)];
    }

    /**
     * Resumable chunk of one large file. The part file's length is the
     * checkpoint; a mismatching offset returns the part length so the
     * sender realigns.
     */
    public function receiveFileChunk(
        string $jobId,
        string $key,
        string $relativePath,
        int $offset,
        string $content,
        string $expectedHash,
        bool $final
    ): array {
        $relativePath = SystemArchiveManager::sanitizeRelativePath($relativePath);
        $partPath = $this->artifacts->incomingPath($jobId, "files/{$key}/{$relativePath}.part");
        $destinationPath = $this->sourceFilePath($key, $relativePath);

        if ($offset === 0 && $this->hasHash($destinationPath, $expectedHash)) {
            FileSystemManager::delete($partPath);
            return [
                'success' => true,
                'offset' => (int) FileSystemManager::filesize($destinationPath),
                'complete' => true,
                'already_present' => true,
            ];
        }
        if ($offset === 0 && FileSystemManager::isFile($partPath)) {
            FileSystemManager::delete($partPath);
        }
        $writeResult = FileSystemManager::writeFileSegment($partPath, $content, $offset);

        if (!$writeResult['success'] || !$final) {
            return array_merge($writeResult, ['complete' => false, 'already_present' => false]);
        }
        if (FileSystemManager::hashFile($partPath) !== $expectedHash) {
            FileSystemManager::delete($partPath);
            throw new DataSyncHashMismatchException("{$key}/{$relativePath}");
        }
        if (!FileSystemManager::moveFile($partPath, $destinationPath)) {
            throw new \RuntimeException("Unable to move the received resource file into place: {$key}/{$relativePath}");
        }

        return array_merge($writeResult, ['complete' => true, 'already_present' => false]);
    }

    public function createArchive(string $jobId, string $key, array $relativePaths): array
    {
        $archive = SystemArchiveManager::create7z($this->root($key), $relativePaths, $this->artifacts->archivePath($jobId, $key));
        unset($archive['path']);
        return $archive;
    }

    public function readArchiveChunk(string $jobId, string $key, int $offset): array
    {
        $path = $this->artifacts->archivePath($jobId, $key);
        $size = FileSystemManager::filesize($path);
        $content = $size !== false ? FileSystemManager::readFileSegment($path, max(0, $offset), self::CHUNK_BYTES) : false;
        if ($content === false) {
            throw new \RuntimeException("The resource archive is not prepared: {$key}");
        }
        $nextOffset = $offset + strlen($content);

        return [
            'key' => $key,
            'offset' => $offset,
            'next_offset' => $nextOffset,
            'size' => (int) $size,
            'final' => $nextOffset >= (int) $size,
            'content' => base64_encode($content),
        ];
    }

    public function receiveArchiveChunk(
        string $jobId,
        string $key,
        int $offset,
        string $content,
        string $expectedHash,
        bool $final
    ): array {
        $this->root($key);
        $archivePath = $this->artifacts->incomingPath($jobId, "archives/{$key}.7z.part");
        $writeResult = FileSystemManager::writeFileSegment($archivePath, $content, $offset);

        if (!$writeResult['success'] || !$final) {
            return array_merge($writeResult, ['complete' => false]);
        }
        if (FileSystemManager::hashFile($archivePath) !== $expectedHash) {
            FileSystemManager::delete($archivePath);
            throw new DataSyncHashMismatchException("{$key}.7z");
        }

        $files = SystemArchiveManager::extract7z($archivePath, $this->root($key));
        FileSystemManager::delete($archivePath);
        return array_merge($writeResult, ['complete' => true, 'files' => $files]);
    }

    private function hasHash(string $path, string $expectedHash): bool
    {
        $hash = FileSystemManager::isFile($path) ? FileSystemManager::hashFile($path) : false;
        return is_string($hash) && hash_equals($expectedHash, $hash);
    }

    private function hashCachePath(string $key, string $root): string
    {
        $directory = rtrim(PathMapper::getBackupDir(self::HASH_CACHE_SUBDIR), '/\\');
        return $directory . DIRECTORY_SEPARATOR . $key . '-' . substr(hash('sha256', $root), 0, 16) . '.json';
    }

    private function normalizedPath(string $path): string
    {
        $normalized = rtrim(str_replace('\\', '/', $path), '/');
        return PHP_OS_FAMILY === 'Windows' ? strtolower($normalized) : $normalized;
    }
}
