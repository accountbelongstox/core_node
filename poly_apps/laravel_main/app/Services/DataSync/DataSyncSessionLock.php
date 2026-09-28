<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class DataSyncSessionLock
{
    public function run(string $sessionId, callable $callback): array
    {
        $safeSessionId = DataSyncSessionId::require($sessionId);
        $directory = PathMapper::getBackupDir('data-sync/locks');
        $path = rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . $safeSessionId . '.lock';

        return FileSystemManager::runWithExclusiveFileLock($path, $callback);
    }
}
