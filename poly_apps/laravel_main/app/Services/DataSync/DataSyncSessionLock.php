<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class DataSyncSessionLock
{
    public function run(string $sessionId, callable $callback): array
    {
        $safeSessionId = preg_replace('/[^A-Za-z0-9_-]/', '', $sessionId);
        $directory = PathMapper::getBackupDir('data-sync/locks');
        $path = rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . $safeSessionId . '.lock';
        $handle = null;

        if ($safeSessionId === '' || $safeSessionId !== $sessionId) {
            throw new \InvalidArgumentException('Synchronization session ID is invalid.');
        }

        FileSystemManager::ensureDirectoryExists($directory);
        $handle = fopen($path, 'c+b');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open the synchronization session lock.');
        }
        if (!flock($handle, LOCK_EX | LOCK_NB)) {
            fclose($handle);
            return ['acquired' => false, 'result' => null];
        }

        try {
            return ['acquired' => true, 'result' => $callback()];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
