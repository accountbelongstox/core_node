<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use App\Utils\SystemArchiveManager;

final class ResourceSyncService
{
    public const CHUNK_BYTES = 4 * 1024 * 1024;

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
            $covered = false;
            foreach ($coveredPaths as $coveredPath) {
                if ($normalizedPath === $coveredPath || str_starts_with($normalizedPath, $coveredPath . '/')) {
                    $covered = true;
                    break;
                }
            }
            if ($covered) {
                continue;
            }
            $roots[$key] = $path;
            $coveredPaths[] = $normalizedPath;
        }

        return $roots;
    }

    private function normalizedPath(string $path): string
    {
        $normalized = rtrim(str_replace('\\', '/', $path), '/');
        return PHP_OS_FAMILY === 'Windows' ? strtolower($normalized) : $normalized;
    }

    public function manifest(string $key): array
    {
        $root = $this->root($key);
        return [
            'key' => $key,
            'root' => $root,
            'files' => FileSystemManager::fileManifest($root),
        ];
    }

    public function diffManifests(array $localManifest, array $remoteManifest): array
    {
        $different = [];

        foreach ($localManifest as $relativePath => $metadata) {
            if (($remoteManifest[$relativePath] ?? null) !== $metadata) {
                $different[] = $relativePath;
            }
        }

        return $different;
    }

    public function createArchive(string $jobId, string $key, array $relativePaths): array
    {
        $archivePath = PathMapper::getBackupDir("data-sync/archives/{$jobId}/{$key}.7z");
        return SystemArchiveManager::create7z($this->root($key), $relativePaths, $archivePath);
    }

    public function receiveChunk(
        string $jobId,
        string $key,
        int $offset,
        string $content,
        string $expectedHash,
        bool $final
    ): array {
        $archivePath = $this->incomingArchivePath($jobId, $key);
        $writeResult = FileSystemManager::writeFileSegment($archivePath, $content, $offset);

        if (!$writeResult['success'] || !$final) {
            return array_merge($writeResult, ['complete' => false]);
        }

        $actualHash = FileSystemManager::hashFile($archivePath);
        if ($actualHash !== $expectedHash) {
            throw new \RuntimeException('Received resource archive hash does not match the source archive.');
        }

        $files = SystemArchiveManager::extract7z($archivePath, $this->root($key));
        return [
            'success' => true,
            'offset' => $writeResult['offset'],
            'complete' => true,
            'files' => $files,
            'sha256' => $actualHash,
        ];
    }

    public function root(string $key): string
    {
        $roots = $this->roots();

        if (!isset($roots[$key])) {
            throw new \InvalidArgumentException("Unknown resource root: {$key}");
        }

        return $roots[$key];
    }

    private function incomingArchivePath(string $jobId, string $key): string
    {
        $safeJobId = DataSyncSessionId::require($jobId);
        $this->root($key);

        return PathMapper::getBackupDir("data-sync/incoming/{$safeJobId}/{$key}.7z.part");
    }

    public function sourceFilePath(string $key, string $relativePath): string
    {
        $relativePath = SystemArchiveManager::sanitizeRelativePath($relativePath);
        return rtrim($this->root($key), '/\\') . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    }

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
        $safeJobId = DataSyncSessionId::require($jobId);
        $this->root($key);
        $partPath = PathMapper::getBackupDir("data-sync/incoming/{$safeJobId}/files/{$key}/{$relativePath}.part");
        $destinationPath = $this->sourceFilePath($key, $relativePath);
        $destinationHash = FileSystemManager::hashFile($destinationPath);

        if ($destinationHash !== false && hash_equals($expectedHash, $destinationHash)) {
            return [
                'success' => true,
                'offset' => (int) FileSystemManager::filesize($destinationPath),
                'complete' => true,
                'sha256' => $expectedHash,
                'already_present' => true,
            ];
        }
        $writeResult = FileSystemManager::writeFileSegment($partPath, $content, $offset);

        if (!$writeResult['success'] || !$final) {
            return array_merge($writeResult, ['complete' => false]);
        }
        if (FileSystemManager::hashFile($partPath) !== $expectedHash) {
            throw new \RuntimeException('Received resource file hash does not match the source file.');
        }

        FileSystemManager::ensureDirectoryExists(dirname($destinationPath));
        if (!FileSystemManager::replaceFile($partPath, $destinationPath)) {
            throw new \RuntimeException('Unable to move the received resource file into place.');
        }

        return array_merge($writeResult, [
            'complete' => true,
            'sha256' => $expectedHash,
            'already_present' => false,
        ]);
    }
}
