<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class DataSyncReceiptStore
{
    public function recordResource(string $jobId, string $identity): bool
    {
        $safeJobId = DataSyncSessionId::require($jobId);
        $directory = PathMapper::getBackupDir("data-sync/receipts/{$safeJobId}/resources");
        $path = rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . hash('sha256', $identity) . '.receipt';
        if (FileSystemManager::isFile($path)) {
            return false;
        }

        FileSystemManager::ensureDirectoryExists($directory);
        if (!FileSystemManager::writeFile($path, 'completed')) {
            throw new \RuntimeException('Unable to persist the resource completion receipt.');
        }

        return true;
    }
}
