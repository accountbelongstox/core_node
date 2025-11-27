<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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
        $result = null;

        if (file_exists($path)) {
            if (is_dir($path)) {
                if (self::$autoFixPermissions) {
                    self::fixPermissions($path);
                }
                return true;
            }
            return false;
        }

        $result = mkdir($path, $mode, $recursive);

        if ($result && self::$autoFixPermissions) {
            self::fixPermissions($path);
        }

        return $result;
    }

    public static function writeFile(string $path, string $content): bool
    {
        $result = null;

        $path = self::mapExternalPath($path);

        $userInfo = self::$cachedUserInfo;
        if ($userInfo === null) {
            $userInfo = SystemUserDetector::getActualUser();
            self::$cachedUserInfo = $userInfo;
        }

        $parentDir = dirname($path);
        if (!file_exists($parentDir)) {
            self::mkdir($parentDir, 0755, true);
        }

        if (self::$autoFixPermissions && file_exists($parentDir)) {
            self::fixPermissions($parentDir);
        }

        $tempFile = tempnam(sys_get_temp_dir(), 'fsm_');
        file_put_contents($tempFile, $content);

        $escapedSource = escapeshellarg($tempFile);
        $escapedDest = escapeshellarg($path);
        $username = escapeshellarg($userInfo['username']);

        $command = "sudo -u {$username} cp {$escapedSource} {$escapedDest} 2>&1";
        $output = shell_exec($command);
        $result = file_exists($path);

        @unlink($tempFile);

        if ($result && self::$autoFixPermissions) {
            self::fixPermissions($path);
        }

        return $result;
    }

    public static function readFile(string $path): string|false
    {
        // Map path to writable storage if needed
        $mappedPath = self::mapExternalPath($path);

        if (!file_exists($mappedPath)) {
            return false;
        }

        if (self::$autoFixPermissions) {
            self::fixPermissions($mappedPath);
        }

        return file_get_contents($mappedPath);
    }

    public static function copy(string $source, string $destination): bool
    {
        $mappedSource = self::mapExternalPath($source);
        $mappedDestination = self::mapExternalPath($destination);

        $userInfo = self::$cachedUserInfo;
        if ($userInfo === null) {
            $userInfo = SystemUserDetector::getActualUser();
            self::$cachedUserInfo = $userInfo;
        }

        if (self::$autoFixPermissions) {
            if (file_exists($mappedSource)) {
                self::fixPermissions($mappedSource);
            }

            $destParent = dirname($mappedDestination);
            if (file_exists($destParent)) {
                self::fixPermissions($destParent);
            }
        }

        $escapedSource = escapeshellarg($mappedSource);
        $escapedDest = escapeshellarg($mappedDestination);
        $username = escapeshellarg($userInfo['username']);

        $command = "sudo -u {$username} cp {$escapedSource} {$escapedDest} 2>&1";
        shell_exec($command);

        $result = file_exists($mappedDestination);

        if ($result && self::$autoFixPermissions) {
            self::fixPermissions($mappedDestination);
        }

        return $result;
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

        if (is_file($mappedPath)) {
            $command = "sudo -u {$username} rm {$escapedPath} 2>&1";
            shell_exec($command);
        } elseif (is_dir($mappedPath)) {
            $command = "sudo -u {$username} rmdir {$escapedPath} 2>&1";
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
}
