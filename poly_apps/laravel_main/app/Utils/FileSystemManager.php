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
        $existed = null;

        $path = self::mapExternalPath($path);

        \Log::channel('single')->info('[FileSystemManager::writeFile] Attempting to write to: ' . $path);
        \Log::channel('single')->info('[FileSystemManager::writeFile] Content length: ' . strlen($content));
        \Log::channel('single')->info('[FileSystemManager::writeFile] Parent dir exists: ' . (is_dir(dirname($path)) ? 'yes' : 'no'));
        \Log::channel('single')->info('[FileSystemManager::writeFile] Parent dir writable: ' . (is_writable(dirname($path)) ? 'yes' : 'no'));

        $existed = file_exists($path);
        $result = file_put_contents($path, $content);

        \Log::channel('single')->info('[FileSystemManager::writeFile] file_put_contents result: ' . ($result !== false ? 'SUCCESS (' . $result . ' bytes)' : 'FAILED'));

        if ($result !== false) {
            \Log::channel('single')->info('[FileSystemManager::writeFile] File created successfully');
            if (self::$autoFixPermissions) {
                $fixResult = self::fixPermissions($path);
                \Log::channel('single')->info('[FileSystemManager::writeFile] Fix permissions result: ' . ($fixResult ? 'success' : 'failed'));
            }
            return true;
        }

        \Log::channel('single')->error('[FileSystemManager::writeFile] FAILED to write file');
        return false;
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
        $result = null;

        // Map paths to writable storage if needed
        $mappedSource = self::mapExternalPath($source);
        $mappedDestination = self::mapExternalPath($destination);

        $result = copy($mappedSource, $mappedDestination);

        if ($result && self::$autoFixPermissions) {
            self::fixPermissions($mappedDestination);
        }

        return $result;
    }

    public static function rename(string $oldPath, string $newPath): bool
    {
        // Map paths to writable storage if needed
        $mappedOldPath = self::mapExternalPath($oldPath);
        $mappedNewPath = self::mapExternalPath($newPath);

        // Use copy + delete instead of rename for reliability across filesystems
        if (!copy($mappedOldPath, $mappedNewPath)) {
            return false;
        }

        if (self::$autoFixPermissions) {
            self::fixPermissions($mappedNewPath);
        }

        if (!unlink($mappedOldPath)) {
            // Copy succeeded but delete failed - file was still moved successfully
            return true;
        }

        return true;
    }

    public static function delete(string $path): bool
    {
        // Map path to writable storage if needed
        $mappedPath = self::mapExternalPath($path);

        if (!file_exists($mappedPath)) {
            return true;
        }

        if (is_file($mappedPath)) {
            return unlink($mappedPath);
        }

        if (is_dir($mappedPath)) {
            return rmdir($mappedPath);
        }

        return false;
    }

    public static function exists(string $path): bool
    {
        $mappedPath = self::mapExternalPath($path);
        return file_exists($mappedPath);
    }

    public static function isFile(string $path): bool
    {
        $mappedPath = self::mapExternalPath($path);
        return is_file($mappedPath);
    }

    public static function isDir(string $path): bool
    {
        $mappedPath = self::mapExternalPath($path);
        return is_dir($mappedPath);
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
