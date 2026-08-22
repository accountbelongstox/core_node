<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Providers\PathMapper;
use App\Support\QueueCenterContract;
use App\Utils\FileSystemManager;

final class AppQyV1DurableOffsetUploadService
{
    private const STORAGE_SUBDIR = 'writeback/app_qy_v1/worker_audio';

    private const MIN_AUDIO_BYTES = 100;

    public function receive(
        string $lane,
        string $identity,
        string $chunk,
        int $offset,
        int $totalBytes,
        string $audioSha256,
        string $chunkSha256
    ): ?array {
        $contract = [];
        $maximumChunkBytes = 0;
        $transferKey = '';
        $spoolPath = '';
        $writeResult = [];
        $nextOffset = 0;
        $complete = false;
        $storedBytes = false;

        $lane = trim($lane);
        $identity = trim($identity);
        $contract = QueueCenterContract::httpTransfer();
        $maximumChunkBytes = max(1, (int) ($contract['maximum_chunk_bytes'] ?? 1048576));
        if ($lane === ''
            || $identity === ''
            || $offset < 0
            || $offset >= $totalBytes
            || $totalBytes < self::MIN_AUDIO_BYTES
            || $chunk === ''
            || strlen($chunk) > $maximumChunkBytes
            || !preg_match('/^[a-f0-9]{64}$/', $audioSha256)
            || !preg_match('/^[a-f0-9]{64}$/', $chunkSha256)
            || !hash_equals($chunkSha256, hash('sha256', $chunk))
        ) {
            return null;
        }

        $transferKey = hash('sha256', $lane . ':' . $identity);
        $spoolPath = $this->storageDirectory() . DIRECTORY_SEPARATOR
            . $transferKey . '.' . $audioSha256 . '.part';
        $writeResult = FileSystemManager::writeFileSegment($spoolPath, $chunk, $offset);
        $nextOffset = (int) ($writeResult['offset'] ?? 0);
        if ($nextOffset < 0 || $nextOffset > $totalBytes) {
            return null;
        }
        $complete = $nextOffset === $totalBytes;
        if ($complete) {
            $storedBytes = FileSystemManager::readFile($spoolPath);
            if ($storedBytes === false
                || strlen($storedBytes) !== $totalBytes
                || !hash_equals($audioSha256, hash('sha256', $storedBytes))
            ) {
                return null;
            }
        }

        return [
            'upload_protocol' => (string) ($contract['protocol'] ?? 'offset-v1'),
            'transfer_id' => $transferKey,
            'offset' => $nextOffset,
            'total_bytes' => $totalBytes,
            'progress' => round(($nextOffset / $totalBytes) * 100, 2),
            'upload_complete' => $complete,
            'accepted' => (bool) ($writeResult['success'] ?? false),
            'idempotent' => !($writeResult['success'] ?? false),
            'busy' => (bool) ($writeResult['busy'] ?? false),
            'retry_after_ms' => (bool) ($writeResult['busy'] ?? false)
                ? max(1, (int) ($contract['retry_interval_ms'] ?? 250))
                : 0,
            'spool_path' => $spoolPath,
        ];
    }

    public function completedBytes(array $receipt): string|false
    {
        $spoolPath = '';

        if (!($receipt['upload_complete'] ?? false)) {
            return false;
        }
        $spoolPath = (string) ($receipt['spool_path'] ?? '');

        return $spoolPath !== '' ? FileSystemManager::readFile($spoolPath) : false;
    }

    public function publicReceipt(array $receipt): array
    {
        unset($receipt['spool_path']);

        return $receipt;
    }

    private function storageDirectory(): string
    {
        $directory = '';

        $directory = PathMapper::getLaravelDataDir(self::STORAGE_SUBDIR);
        FileSystemManager::ensureDirectoryExists($directory);

        return rtrim($directory, '/\\');
    }
}
