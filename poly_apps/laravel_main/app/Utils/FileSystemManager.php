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

    public static function setAutoFixPermissions(bool $enabled): void
    {
        self::$autoFixPermissions = $enabled;
    }

    private static function mapExternalPath(string $path): string
    {
        $coreNodeDir = \App\Providers\PathMapper::getCoreNodeDir();
        $laravelMainDir = \App\Providers\PathMapper::getLaravelMainDir();
        $storageDir = $laravelMainDir . DIRECTORY_SEPARATOR . 'storage';

        if (strpos($path, $coreNodeDir) === 0 && strpos($path, $storageDir) === false) {
            $relativePath = str_replace($coreNodeDir . DIRECTORY_SEPARATOR, '', $path);
            $mappedPath = $storageDir . DIRECTORY_SEPARATOR . 'external' . DIRECTORY_SEPARATOR . $relativePath;

            $mappedDir = dirname($mappedPath);
            if (!file_exists($mappedDir)) {
                @mkdir($mappedDir, 0755, true);
            }

            $symlinkPath = $path;
            $symlinkTarget = $mappedPath;

            if (!file_exists($symlinkPath) && !is_link($symlinkPath)) {
                $symlinkDir = dirname($symlinkPath);
                if (file_exists($symlinkDir) && is_writable($symlinkDir)) {
                    @symlink($symlinkTarget, $symlinkPath);
                }
            }

            self::$externalPathMappings[$path] = $mappedPath;
            return $mappedPath;
        }

        return $path;
    }

    public static function mkdir(string $path, int $mode = 0755, bool $recursive = true): bool
    {
        $result = null;

        if (file_exists($path)) {
            if (is_dir($path)) {
                if (self::$autoFixPermissions) {
                    @self::fixPermissions($path);
                }
                return true;
            }
            return false;
        }

        $result = @mkdir($path, $mode, $recursive);

        if ($result && self::$autoFixPermissions) {
            @self::fixPermissions($path);
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
        $result = @file_put_contents($path, $content);

        \Log::channel('single')->info('[FileSystemManager::writeFile] file_put_contents result: ' . ($result !== false ? 'SUCCESS (' . $result . ' bytes)' : 'FAILED'));

        if ($result !== false) {
            \Log::channel('single')->info('[FileSystemManager::writeFile] File created successfully');
            if (self::$autoFixPermissions) {
                $fixResult = @self::fixPermissions($path);
                \Log::channel('single')->info('[FileSystemManager::writeFile] Fix permissions result: ' . ($fixResult ? 'success' : 'failed'));
            }
            return true;
        }

        \Log::channel('single')->error('[FileSystemManager::writeFile] FAILED to write file');
        return false;
    }

    public static function readFile(string $path): string|false
    {
        if (!file_exists($path)) {
            return false;
        }

        if (self::$autoFixPermissions) {
            @self::fixPermissions($path);
        }

        return @file_get_contents($path);
    }

    public static function copy(string $source, string $destination): bool
    {
        $result = null;

        $result = @copy($source, $destination);

        if ($result && self::$autoFixPermissions) {
            @self::fixPermissions($destination);
        }

        return $result;
    }

    public static function rename(string $oldPath, string $newPath): bool
    {
        $result = null;

        $result = @rename($oldPath, $newPath);

        if ($result && self::$autoFixPermissions) {
            @self::fixPermissions($newPath);
        }

        return $result;
    }

    public static function delete(string $path): bool
    {
        if (!file_exists($path)) {
            return true;
        }

        if (is_file($path)) {
            return @unlink($path);
        }

        if (is_dir($path)) {
            return @rmdir($path);
        }

        return false;
    }

    public static function exists(string $path): bool
    {
        return file_exists($path);
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
        $userInfo = null;
        $result = true;

        if (!file_exists($path)) {
            return false;
        }

        $userInfo = SystemUserDetector::getActualUser();

        if (!$userInfo || !isset($userInfo['uid']) || !isset($userInfo['gid'])) {
            return false;
        }

        $currentOwner = @fileowner($path);
        $currentGroup = @filegroup($path);

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
                @self::fixPermissions($path);
            }
            return true;
        }

        return self::mkdir($path, $mode, true);
    }
}
