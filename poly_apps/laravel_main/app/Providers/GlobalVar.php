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


namespace App\Providers;

use Illuminate\Support\Facades\File;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

class GlobalVar
{
    private static string $corenodeName = "core_node";

    /**
     * Get base directory path
     */
    protected static function getBaseDir(): string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return env('HOME', '') . DIRECTORY_SEPARATOR . static::$corenodeName;
        }
        return '/usr/' . static::$corenodeName;
    }

    /**
     * Ensure directory exists
     */
    protected static function ensureDirectoryExists(): void
    {
        $baseDir = static::getBaseDir();
        if (!File::exists($baseDir)) {
            File::makeDirectory($baseDir, 0755, true, true);
        }
    }

    /**
     * Scan directory and return all files with their contents
     */
    protected static function scanFiles(): array
    {
        static::ensureDirectoryExists();
        $baseDir = static::getBaseDir();
        $fileMap = [];
        
        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator(
                    $baseDir,
                    RecursiveDirectoryIterator::SKIP_DOTS
                )
            );

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $relativePath = str_replace($baseDir . DIRECTORY_SEPARATOR, '', $file->getPathname());
                    $key = $file->getFilename();
                    
                    try {
                        $fileMap[$key] = File::get($file->getPathname());
                    } catch (\Exception $e) {
                        \Log::error("Failed to read file: {$file->getPathname()}", [
                            'error' => $e->getMessage()
                        ]);
                    }
                }
            }
        } catch (\Exception $e) {
            \Log::error("Failed to scan directory: {$baseDir}", [
                'error' => $e->getMessage()
            ]);
        }

        return $fileMap;
    }

    /**
     * Get all files and their contents (real-time scan)
     */
    public static function all(): array
    {
        return static::scanFiles();
    }

    /**
     * Get content of a specific file (real-time read)
     */
    public static function get(string $key, $default = null)
    {
        $filePath = static::resolveFilePath($key);
        
        if (File::exists($filePath)) {
            try {
                return File::get($filePath);
            } catch (\Exception $e) {
                \Log::error("Failed to read file: {$filePath}", [
                    'error' => $e->getMessage()
                ]);
                return $default;
            }
        }
        
        return $default;
    }

    /**
     * Set content to a file
     */
    public static function set(string $key, string $value): bool
    {
        $filePath = static::resolveFilePath($key);
        $dirPath = dirname($filePath);

        try {
            if (!File::exists($dirPath)) {
                File::makeDirectory($dirPath, 0755, true, true);
            }

            return File::put($filePath, $value) !== false;
        } catch (\Exception $e) {
            \Log::error("Failed to write file: {$filePath}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Delete a file
     */
    public static function delete(string $key): bool
    {
        $filePath = static::resolveFilePath($key);

        try {
            if (File::exists($filePath)) {
                return File::delete($filePath);
            }
            return false;
        } catch (\Exception $e) {
            \Log::error("Failed to delete file: {$filePath}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Check if file exists
     */
    public static function has(string $key): bool
    {
        return File::exists(static::resolveFilePath($key));
    }

    /**
     * Get all available keys
     */
    public static function keys(): array
    {
        return array_keys(static::scanFiles());
    }

    /**
     * Clear all files
     */
    public static function clear(): bool
    {
        $baseDir = static::getBaseDir();
        try {
            if (File::exists($baseDir)) {
                File::deleteDirectory($baseDir);
                File::makeDirectory($baseDir, 0755, true, true);
                return true;
            }
            return false;
        } catch (\Exception $e) {
            \Log::error("Failed to clear directory: {$baseDir}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Convert key to filesystem path
     */
    protected static function resolveFilePath(string $key): string
    {
        return static::getBaseDir() . DIRECTORY_SEPARATOR . str_replace('.', DIRECTORY_SEPARATOR, $key);
    }

    /**
     * Get the base directory path
     */
    public static function getBaseDirectory(): string
    {
        return static::getBaseDir();
    }

}