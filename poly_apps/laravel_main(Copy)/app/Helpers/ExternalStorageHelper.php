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


namespace App\Helpers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class ExternalStorageHelper
{
    /**
     * Get the current operating system
     */
    public static function getOS(): string
    {
        $os = PHP_OS;
        
        if (str_starts_with($os, 'WIN')) {
            return 'windows';
        } else {
            return 'linux';
        }
    }

    /**
     * Get external storage path for a specific type
     */
    public static function getPath(string $type): string
    {
        $os = self::getOS();
        $config = config("storage.external.{$type}");
        
        if (!$config || !isset($config[$os])) {
            throw new \InvalidArgumentException("External storage path not configured for type '{$type}' on OS '{$os}'");
        }
        
        $path = $config[$os];
        
        // Auto-create directory if enabled
        if (config('storage.auto_create', true)) {
            self::ensureDirectoryExists($path);
        }
        
        return $path;
    }

    /**
     * Get upload directory path
     */
    public static function getUploadPath(): string
    {
        return self::getPath('upload');
    }

    /**
     * Get static files directory path
     */
    public static function getStaticPath(): string
    {
        return self::getPath('static');
    }

    /**
     * Get backup directory path
     */
    public static function getBackupPath(): string
    {
        return self::getPath('backup');
    }

    /**
     * Get cache directory path
     */
    public static function getCachePath(): string
    {
        return self::getPath('cache');
    }

    /**
     * Get updates directory path
     */
    public static function getUpdatesPath(): string
    {
        return self::getPath('updates');
    }

    /**
     * Get logs directory path
     */
    public static function getLogsPath(): string
    {
        return self::getPath('logs');
    }

    /**
     * Get temp directory path
     */
    public static function getTempPath(): string
    {
        return self::getPath('temp');
    }

    /**
     * Ensure directory exists and is writable
     */
    public static function ensureDirectoryExists(string $path): bool
    {
        try {
            if (!File::exists($path)) {
                $permissions = config('storage.permissions.directory', 0755);
                File::makeDirectory($path, $permissions, true);
                Log::info("Created external storage directory: {$path}");
            }
            
            if (!is_writable($path)) {
                Log::warning("External storage directory is not writable: {$path}");
                return false;
            }
            
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to create external storage directory: {$path}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get full path for a file within external storage
     */
    public static function getFullPath(string $type, string $subPath = ''): string
    {
        $basePath = self::getPath($type);
        
        if (empty($subPath)) {
            return $basePath;
        }
        
        return $basePath . DIRECTORY_SEPARATOR . trim($subPath, '/\\');
    }

    /**
     * Get relative path from external storage base
     */
    public static function getRelativePath(string $type, string $fullPath): string
    {
        $basePath = self::getPath($type);
        return trim(str_replace([$basePath, '\\'], ['', '/'], $fullPath), '/');
    }

    /**
     * Check if a path is within external storage
     */
    public static function isWithinExternalStorage(string $type, string $path): bool
    {
        $basePath = self::getPath($type);
        $realPath = realpath($path);
        $realBasePath = realpath($basePath);
        
        if (!$realPath || !$realBasePath) {
            return false;
        }
        
        return str_starts_with($realPath, $realBasePath);
    }

    /**
     * Get all external storage paths
     */
    public static function getAllPaths(): array
    {
        return [
            'upload' => self::getUploadPath(),
            'static' => self::getStaticPath(),
            'backup' => self::getBackupPath(),
            'cache' => self::getCachePath(),
            'updates' => self::getUpdatesPath(),
            'logs' => self::getLogsPath(),
            'temp' => self::getTempPath(),
        ];
    }

    /**
     * Validate all external storage paths
     */
    public static function validatePaths(): array
    {
        $results = [];
        $paths = self::getAllPaths();
        
        foreach ($paths as $type => $path) {
            $results[$type] = [
                'path' => $path,
                'exists' => File::exists($path),
                'writable' => is_writable($path),
                'valid' => File::exists($path) && is_writable($path),
            ];
        }
        
        return $results;
    }
} 