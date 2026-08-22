<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Utils;

class FileSystemManager
{
    private static $autoFixPermissions = true;
    private static $externalPathMappings = [];
    private static $cachedUserInfo = null;

    public static function setAutoFixPermissions(bool $enabled): void
    {
        self::$autoFixPermissions = $enabled;
    }

    private static function mapExternalPath(string $path): string
    {
        // Check cache first for performance
        if (isset(self::$externalPathMappings[$path])) {
            return self::$externalPathMappings[$path];
        }

        $coreNodeDir = \App\Providers\PathMapper::getCoreNodeDir();
        $laravelMainDir = \App\Providers\PathMapper::getLaravelMainDir();
        $storageDir = $laravelMainDir . DIRECTORY_SEPARATOR . 'storage';

        // Don't map the root directories themselves
        if ($path === $coreNodeDir || $path === $laravelMainDir || $path === $storageDir) {
            self::$externalPathMappings[$path] = $path;
            return $path;
        }

        $startsWithCoreNode = strpos($path, $coreNodeDir) === 0;
        $containsStorage = strpos($path, $storageDir) !== false;

        if ($startsWithCoreNode && !$containsStorage) {
            $relativePath = str_replace($coreNodeDir . DIRECTORY_SEPARATOR, '', $path);
            $mappedPath = $storageDir . DIRECTORY_SEPARATOR . 'external' . DIRECTORY_SEPARATOR . $relativePath;

            $mappedDir = dirname($mappedPath);
            if (!file_exists($mappedDir)) {
                try {
                    mkdir($mappedDir, 0755, true);
                } catch (\Throwable $e) {
                    \Log::error('[FileSystemManager] Failed to create mapped dir: ' . $mappedDir . ' - ' . $e->getMessage());
                }
            }

            $symlinkPath = $path;
            $symlinkTarget = $mappedPath;

            if (!file_exists($symlinkPath) && !is_link($symlinkPath)) {
                $symlinkDir = dirname($symlinkPath);
                if (file_exists($symlinkDir) && is_writable($symlinkDir)) {
                    try {
                        symlink($symlinkTarget, $symlinkPath);
                    } catch (\Throwable $e) {
                        \Log::error('[FileSystemManager] Failed to create symlink: ' . $symlinkPath . ' -> ' . $symlinkTarget . ' - ' . $e->getMessage());
                    }
                }
            }

            self::$externalPathMappings[$path] = $mappedPath;
            return $mappedPath;
        }

        // Cache non-mapped paths too
        self::$externalPathMappings[$path] = $path;
        return $path;
    }

    public static function mkdir(string $path, int $mode = 0755, bool $recursive = true): bool
    {
        if (file_exists($path)) {
            if (is_dir($path)) {
                return true;
            }
            return false;
        }

        $result = mkdir($path, $mode, $recursive);

        if ($result) {
            $userInfo = SystemUserDetector::getActualUser();
            if ($userInfo && isset($userInfo['uid'], $userInfo['gid'])) {
                @chown($path, $userInfo['uid']);
                @chgrp($path, $userInfo['gid']);
            }
            @chmod($path, $mode);
        }

        return $result;
    }

    public static function writeFile(string $path, string $content): bool
    {
        $path = self::mapExternalPath($path);

        $userInfo = SystemUserDetector::getActualUser();

        $parentDir = dirname($path);
        if (!file_exists($parentDir)) {
            self::mkdir($parentDir, 0755, true);
            if ($userInfo && isset($userInfo['uid'], $userInfo['gid'])) {
                @chown($parentDir, $userInfo['uid']);
                @chgrp($parentDir, $userInfo['gid']);
                @chmod($parentDir, 0755);
            }
        }

        $result = file_put_contents($path, $content, LOCK_EX) !== false;

        if ($result && $userInfo && isset($userInfo['uid'], $userInfo['gid'])) {
            @chown($path, $userInfo['uid']);
            @chgrp($path, $userInfo['gid']);
            @chmod($path, 0644);
        }

        return $result;
    }

    public static function writePrivateFile(string $path, string $content): bool
    {
        $result = self::writeFile($path, $content);

        return $result && self::ensureFileMode($path, 0600);
    }

    public static function ensureFileMode(string $path, int $mode): bool
    {
        $permissions = false;
        $resolvedPath = file_exists($path) ? $path : self::mapExternalPath($path);

        if (!self::isFile($resolvedPath)) {
            return false;
        }
        if (\App\Providers\PathMapper::isWindows()) {
            return true;
        }

        @chmod($resolvedPath, $mode);
        $permissions = fileperms($resolvedPath);

        return is_int($permissions) && ($permissions & 0777) === $mode;
    }

    public static function readFile(string $path, bool $fixPermissions = true): string|false
    {
        $mappedPath = file_exists($path) ? $path : self::mapExternalPath($path);

        if (!file_exists($mappedPath)) {
            return false;
        }

        if ($fixPermissions && self::$autoFixPermissions) {
            self::fixPermissions($mappedPath);
        }

        $handle = fopen($mappedPath, 'rb');
        if ($handle === false) {
            return false;
        }

        flock($handle, LOCK_SH);
        $content = stream_get_contents($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        return $content;
    }

    public static function readFileSegment(string $path, int $offset = 0, ?int $length = null): string|false
    {
        $mappedPath = self::mapExternalPath($path);
        $handle = null;
        $content = false;

        if (!file_exists($mappedPath) || !is_readable($mappedPath)) {
            return false;
        }

        if (self::$autoFixPermissions) {
            self::fixPermissions($mappedPath);
        }

        $handle = fopen($mappedPath, 'rb');
        if ($handle === false) {
            return false;
        }

        if ($offset > 0 && fseek($handle, $offset) !== 0) {
            fclose($handle);
            return false;
        }

        $content = $length === null
            ? stream_get_contents($handle)
            : stream_get_contents($handle, $length);
        fclose($handle);

        return $content;
    }

    public static function writeFileSegment(string $path, string $content, int $expectedOffset): array
    {
        $mappedPath = self::mapExternalPath($path);
        $parentDir = dirname($mappedPath);
        $handle = null;
        $currentSize = 0;
        $written = 0;

        self::ensureDirectoryExists($parentDir);
        $handle = fopen($mappedPath, 'c+b');
        if ($handle === false) {
            return ['success' => false, 'offset' => 0];
        }

        if (!flock($handle, LOCK_EX | LOCK_NB)) {
            clearstatcache(true, $mappedPath);
            $currentSize = (int) (@filesize($mappedPath) ?: 0);
            fclose($handle);
            return ['success' => false, 'offset' => $currentSize, 'busy' => true];
        }
        fseek($handle, 0, SEEK_END);
        $currentSize = ftell($handle);
        if ($currentSize !== $expectedOffset) {
            flock($handle, LOCK_UN);
            fclose($handle);
            return ['success' => false, 'offset' => $currentSize, 'busy' => false];
        }

        $written = fwrite($handle, $content);
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        if ($written === false || $written !== strlen($content)) {
            return ['success' => false, 'offset' => $currentSize, 'busy' => false];
        }

        self::fixPermissions($mappedPath);
        return ['success' => true, 'offset' => $currentSize + $written, 'busy' => false];
    }

    public static function runWithExclusiveFileLock(string $path, callable $callback, bool $blocking = false): array
    {
        $mappedPath = self::mapExternalPath($path);
        $handle = null;
        $operation = LOCK_EX | ($blocking ? 0 : LOCK_NB);

        self::ensureDirectoryExists(dirname($mappedPath));
        $handle = fopen($mappedPath, 'c+b');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open the exclusive file lock.');
        }
        if (!flock($handle, $operation)) {
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

    public static function hashFile(string $path, string $algorithm = 'sha256'): string|false
    {
        $mappedPath = self::mapExternalPath($path);

        if (!is_file($mappedPath) || !is_readable($mappedPath)) {
            return false;
        }

        return hash_file($algorithm, $mappedPath);
    }

    public static function fileManifest(string $rootPath): array
    {
        $mappedRoot = self::mapExternalPath($rootPath);
        $manifest = [];
        $iterator = null;

        if (!is_dir($mappedRoot)) {
            return $manifest;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($mappedRoot, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($iterator as $file) {
            if (!$file->isFile() || !$file->isReadable()) {
                continue;
            }

            $absolutePath = $file->getPathname();
            $relativePath = substr($absolutePath, strlen(rtrim($mappedRoot, '/\\')) + 1);
            $relativePath = str_replace('\\', '/', $relativePath);
            $manifest[$relativePath] = [
                'size' => $file->getSize(),
                'sha256' => hash_file('sha256', $absolutePath),
            ];
        }

        ksort($manifest);
        return $manifest;
    }

    public static function copy(string $source, string $destination): bool
    {
        $mappedSource = self::mapExternalPath($source);
        $mappedDestination = self::mapExternalPath($destination);
        $result = false;

        if (self::$autoFixPermissions) {
            if (file_exists($mappedSource)) {
                self::fixPermissions($mappedSource);
            }
        }

        self::ensureDirectoryExists(dirname($mappedDestination));
        $result = copy($mappedSource, $mappedDestination);

        if ($result && self::$autoFixPermissions) {
            self::fixPermissions($mappedDestination);
        }

        return $result;
    }

    public static function replaceFile(string $source, string $destination): bool
    {
        $mappedSource = self::mapExternalPath($source);
        $mappedDestination = self::mapExternalPath($destination);
        $copied = false;

        if (!is_file($mappedSource)) {
            return false;
        }

        self::ensureDirectoryExists(dirname($mappedDestination));
        $copied = copy($mappedSource, $mappedDestination);
        if (!$copied) {
            return false;
        }

        self::fixPermissions($mappedDestination);
        unlink($mappedSource);
        return true;
    }

    public static function rename(string $oldPath, string $newPath): bool
    {
        $resolvedOldPath = realpath($oldPath);
        if ($resolvedOldPath === false) {
            error_log('[FileSystemManager::rename] Source path does not exist: ' . $oldPath);
            return false;
        }

        $mappedOldPath = self::mapExternalPath($resolvedOldPath);
        $mappedNewPath = self::mapExternalPath($newPath);

        error_log('[FileSystemManager::rename] Original old path: ' . $oldPath);
        error_log('[FileSystemManager::rename] Resolved old path: ' . $resolvedOldPath);
        error_log('[FileSystemManager::rename] Mapped old path: ' . $mappedOldPath);
        error_log('[FileSystemManager::rename] Mapped new path: ' . $mappedNewPath);

        $userInfo = self::$cachedUserInfo;
        if ($userInfo === null) {
            $userInfo = SystemUserDetector::getActualUser();
            self::$cachedUserInfo = $userInfo;
        }

        if (self::$autoFixPermissions) {
            if (file_exists($mappedOldPath)) {
                self::fixPermissions($mappedOldPath);
            }

            $sourceParent = dirname($mappedOldPath);
            if (file_exists($sourceParent)) {
                self::fixPermissions($sourceParent);
            }

            $targetParent = dirname($mappedNewPath);
            if (file_exists($targetParent)) {
                self::fixPermissions($targetParent);
            }
        }

        $escapedSource = escapeshellarg($mappedOldPath);
        $escapedDest = escapeshellarg($mappedNewPath);
        $username = escapeshellarg($userInfo['username']);

        $command = "sudo -u {$username} cp {$escapedSource} {$escapedDest} 2>&1";
        $output = shell_exec($command);

        error_log('[FileSystemManager::rename] Copy command: ' . $command);
        error_log('[FileSystemManager::rename] Copy output: ' . ($output ?: '(empty)'));
        error_log('[FileSystemManager::rename] Dest exists after copy: ' . (file_exists($mappedNewPath) ? 'yes' : 'no'));

        if (!file_exists($mappedNewPath)) {
            error_log('[FileSystemManager::rename] FAILED - destination does not exist');
            return false;
        }

        if (self::$autoFixPermissions) {
            self::fixPermissions($mappedNewPath);
        }

        $command = "sudo -u {$username} rm {$escapedSource} 2>&1";
        $output = shell_exec($command);
        error_log('[FileSystemManager::rename] Delete command: ' . $command);
        error_log('[FileSystemManager::rename] Delete command output: ' . ($output ?: '(empty)'));

        $sourceStillExists = file_exists($mappedOldPath);
        error_log('[FileSystemManager::rename] Source still exists after delete: ' . ($sourceStillExists ? 'yes' : 'no'));

        if ($sourceStillExists) {
            error_log('[FileSystemManager::rename] FAILED - source file was not deleted');
            return false;
        }

        error_log('[FileSystemManager::rename] SUCCESS');
        return true;
    }

    public static function delete(string $path): bool
    {
        $mappedPath = self::mapExternalPath($path);

        if (!file_exists($mappedPath)) {
            return true;
        }

        $userInfo = self::$cachedUserInfo;
        if ($userInfo === null) {
            $userInfo = SystemUserDetector::getActualUser();
            self::$cachedUserInfo = $userInfo;
        }

        if (self::$autoFixPermissions) {
            self::fixPermissions($mappedPath);

            $parent = dirname($mappedPath);
            if (file_exists($parent)) {
                self::fixPermissions($parent);
            }
        }

        $escapedPath = escapeshellarg($mappedPath);
        $username = escapeshellarg($userInfo['username']);

        if (is_dir($mappedPath) && !is_link($mappedPath)) {
            $command = "sudo -u {$username} rm -rf {$escapedPath} 2>&1";
            shell_exec($command);
        } else {
            $command = "sudo -u {$username} rm {$escapedPath} 2>&1";
            shell_exec($command);
        }

        return !file_exists($mappedPath);
    }

    public static function exists(string $path): bool
    {
        if (file_exists($path)) {
            return true;
        }

        $mappedPath = self::mapExternalPath($path);
        return file_exists($mappedPath);
    }

    public static function isFile(string $path): bool
    {
        return is_file($path);
    }

    public static function isDir(string $path): bool
    {
        return is_dir($path);
    }

    public static function isReadable(string $path): bool
    {
        return is_readable($path);
    }

    public static function isWritable(string $path): bool
    {
        return is_writable($path);
    }

    public static function scandir(string $path): array|false
    {
        if (self::$autoFixPermissions) {
            @self::fixPermissions($path);
        }

        return @scandir($path);
    }

    public static function filemtime(string $path): int|false
    {
        return @filemtime($path);
    }

    public static function filesize(string $path): int|false
    {
        return @filesize($path);
    }

    public static function fixPermissions(string $path): bool
    {
        if (!file_exists($path)) {
            return false;
        }

        // Cache user info to avoid expensive syscalls
        if (self::$cachedUserInfo === null) {
            self::$cachedUserInfo = SystemUserDetector::getActualUser();
        }

        $userInfo = self::$cachedUserInfo;

        if (!$userInfo || !isset($userInfo['uid']) || !isset($userInfo['gid'])) {
            return false;
        }

        $currentOwner = @fileowner($path);
        $currentGroup = @filegroup($path);

        // Early return if already correct
        if ($currentOwner === $userInfo['uid'] && $currentGroup === $userInfo['gid']) {
            return true;
        }

        $chownResult = @chown($path, $userInfo['uid']);
        $chgrpResult = @chgrp($path, $userInfo['gid']);

        if (is_dir($path)) {
            @chmod($path, 0755);
        } else {
            @chmod($path, 0644);
        }

        return $chownResult && $chgrpResult;
    }

    public static function fixPermissionsRecursive(string $path): bool
    {
        $success = true;
        $entries = null;
        $fullPath = null;

        if (!file_exists($path)) {
            return false;
        }

        self::fixPermissions($path);

        if (!is_dir($path)) {
            return true;
        }

        $entries = @scandir($path);
        if ($entries === false) {
            return false;
        }

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $fullPath = $path . DIRECTORY_SEPARATOR . $entry;

            if (is_dir($fullPath)) {
                if (!self::fixPermissionsRecursive($fullPath)) {
                    $success = false;
                }
            } else {
                if (!self::fixPermissions($fullPath)) {
                    $success = false;
                }
            }
        }

        return $success;
    }

    public static function ensureDirectoryExists(string $path, int $mode = 0755): bool
    {
        $path = self::mapExternalPath($path);

        if (file_exists($path) && is_dir($path)) {
            if (self::$autoFixPermissions) {
                self::fixPermissions($path);
            }
            return true;
        }

        try {
            return self::mkdir($path, $mode, true);
        } catch (\Throwable $e) {
            error_log('[FileSystemManager::ensureDirectoryExists] Failed to create directory: ' . $path . ' - ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Scan directory and calculate file statistics
     * Returns array with: total_size, total_files, zero_byte_files, scanned_directories, errors
     * 
     * @param array $directories Array of directory paths to scan
     * @param array $extensions Array of file extensions to include (e.g., ['mp3', 'wav'])
     * @return array Statistics array
     */
    public static function scanDirectoriesForFiles(array $directories, array $extensions = []): array
    {
        $totalSize = 0;
        $totalFiles = 0;
        $zeroByteFiles = 0;
        $scannedDirectories = [];
        $errors = [];

        foreach ($directories as $dir) {
            try {
                // Use exists() to check if directory exists (handles mapped paths)
                if (!self::exists($dir) || !is_dir($dir)) {
                    continue;
                }

                $dirFiles = 0;
                $dirSize = 0;

                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
                    \RecursiveIteratorIterator::LEAVES_ONLY
                );

                foreach ($iterator as $file) {
                    if ($file->isFile() && $file->isReadable()) {
                        // Filter by extension if provided
                        if (!empty($extensions)) {
                            $extension = strtolower($file->getExtension());
                            if (!in_array($extension, $extensions)) {
                                continue;
                            }
                        }

                        $filePath = $file->getPathname();
                        $fileSize = @filesize($filePath);
                        if ($fileSize !== false) {
                            if ($fileSize > 0) {
                                $totalSize += $fileSize;
                                $totalFiles++;
                                $dirSize += $fileSize;
                                $dirFiles++;
                            } else {
                                $zeroByteFiles++;
                            }
                        }
                    }
                }

                if ($dirFiles > 0 || is_dir($dir)) {
                    $scannedDirectories[] = $dir;
                }
            } catch (\Exception $e) {
                $errorMsg = "Failed to scan directory: {$dir} - " . $e->getMessage();
                $errors[] = $errorMsg;
                \Log::warning($errorMsg);
            }
        }

        return [
            'total_size' => $totalSize,
            'total_files' => $totalFiles,
            'zero_byte_files' => $zeroByteFiles,
            'scanned_directories' => $scannedDirectories,
            'errors' => $errors,
        ];
    }
}
