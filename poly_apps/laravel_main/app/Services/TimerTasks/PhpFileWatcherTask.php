<?php

namespace App\Services\TimerTasks;

use App\Providers\PathMapper;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1OctaneServiceManager;

/**
 * PHP File Watcher Task
 *
 * Monitors PHP files in Laravel application for changes.
 * Automatically restarts Octane service when changes are detected.
 */
class PhpFileWatcherTask extends OctaneTimerTaskAbstract
{
    /**
     * Cooldown period in seconds to prevent restart loops
     */
    protected const RESTART_COOLDOWN = 10;

    /**
     * @inheritDoc
     */
    public function getName(): string
    {
        return 'php_file_watcher';
    }

    /**
     * @inheritDoc
     */
    public function getInterval(): int
    {
        return 5; // Every 5 seconds
    }

    /**
     * @inheritDoc
     */
    public function exec(): void
    {
        try {
            $laravelPath = base_path();
            $tmpDir = PathMapper::getLaravelTmpDir();
            $hashFile = $tmpDir . '/octane_file_watcher_hash.txt';
            $lastRestartFile = $tmpDir . '/octane_last_restart.txt';

            // Check cooldown period to prevent restart loops
            if (file_exists($lastRestartFile)) {
                $lastRestart = (int)file_get_contents($lastRestartFile);
                $timeSinceRestart = time() - $lastRestart;

                if ($timeSinceRestart < self::RESTART_COOLDOWN) {
                    // Still in cooldown period - skip check
                    $this->logDebug('In cooldown period', [
                        'time_remaining' => self::RESTART_COOLDOWN - $timeSinceRestart
                    ]);
                    return;
                }
            }

            // Get the latest modification time hash from file
            $currentHash = file_exists($hashFile) ? trim(file_get_contents($hashFile)) : null;

            // Scan for PHP files and calculate hash
            $newHash = $this->calculatePhpFileHash($laravelPath);

            if ($currentHash === null) {
                // First run - just store the hash
                file_put_contents($hashFile, $newHash);
                $this->logInfo('Initialized', [
                    'service' => self::SERVICE_NAME,
                    'path' => $laravelPath,
                    'hash' => $newHash
                ]);
                return;
            }

            // Check if files have changed
            if ($currentHash !== $newHash) {
                $this->logWarning('Changes detected, restarting Octane service', [
                    'old_hash' => $currentHash,
                    'new_hash' => $newHash
                ]);

                // CRITICAL: Update hash AND timestamp BEFORE restart
                // If we restart first, this process gets killed and files never update
                file_put_contents($hashFile, $newHash);
                file_put_contents($lastRestartFile, (string)time());

                // Use ServerManagerV1OctaneServiceManager to restart service
                // This auto-detects service name and schedules background restart
                $success = ServerManagerV1OctaneServiceManager::restartCurrentOctaneServiceDelayed(1);

                if ($success) {
                    $this->logInfo('Service restart scheduled via manager (delayed 1s, cooldown ' . self::RESTART_COOLDOWN . 's)');
                } else {
                    $this->logError('Failed to schedule service restart');
                }
            }

        } catch (\Throwable $e) {
            $this->logError('Task failed', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * @inheritDoc
     */
    public function isEnabled(): bool
    {
        // Only enable in desktop environment (WSL or GUI Linux)
        // Production servers should NOT auto-restart on file changes
        return PathMapper::hasDesktopEnvironment() || PathMapper::isWSL();
    }

    /**
     * Calculate hash of all PHP files in the Laravel directory
     *
     * @param string $path Base path to scan
     * @return string MD5 hash of all PHP file modification times
     */
    protected function calculatePhpFileHash(string $path): string
    {
        $fileHashes = [];

        // Directories to scan
        $directories = [
            $path . '/app',
            $path . '/config',
            $path . '/routes',
            $path . '/database',
        ];

        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                continue;
            }

            // Scan for PHP files
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    // Use file path and modification time for hash
                    $fileHashes[] = $file->getPathname() . ':' . $file->getMTime();
                }
            }
        }

        // Sort for consistent hash
        sort($fileHashes);

        // Return MD5 hash of all file info
        return md5(implode('|', $fileHashes));
    }
}
