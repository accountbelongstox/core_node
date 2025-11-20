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
use Illuminate\Support\Facades\Log;

/**
 * Path Mapper - Unified path mapping system
 * 
 * This class provides unified path mapping functionality that matches
 * the logic in gvar_common.sh map_web_path() to ensure consistency
 * between shell scripts and PHP code.
 * 
 * Replaces: DatabasePathHelper, ExternalStorageHelper, WebPathHelper
 */
class PathMapper
{
    /**
     * Map web path based on environment (PHP version of gvar_common.sh map_web_path)
     * 
     * @param string $pathKey The path key (wwwroot, nginxconfig, shared-data, backup, www, etc.)
     * @param string|null $subPath Optional sub-path to append
     * @return string The mapped path based on environment
     */
    public static function mapWebPath(string $pathKey, ?string $subPath = null): string
    {
        // Detect environment
        $isWsl = self::isWSL();
        $isProduction = self::isProduction();
        
        // Get base data directory (same logic as get_base_data_directory in gvar_common.sh)
        $dataBase = self::getBaseDataDirectory();
        
        // Determine base path for www based on environment
        if ($isWsl) {
            $basePath = $dataBase . '/www';
        } elseif ($isProduction) {
            $basePath = '/www';
        } else {
            // Desktop environment: use data base + /www, unless data base is already /www
            $basePath = ($dataBase === '/www') ? '/www' : $dataBase . '/www';
        }
        
        // Map paths using common base path
        $mappedPath = match($pathKey) {
            'wwwroot' => $basePath . '/wwwroot',
            'nginxconfig' => $basePath . '/nginxconfig',
            'shared-data' => $basePath . '/shared-data',
            'backup' => $basePath . '/backup',
            'www' => $basePath,
            'laravel_data_dir' => $basePath . '/wwwroot/laravel_db',
            'nginx' => self::findActualPath('/etc/nginx'),
            'php' => self::findActualPath('/etc/php'),
            'logs' => self::findLaravelLogPath($basePath),
            default => $pathKey, // Default: return the key as-is (assume it's already a path)
        };
        
        // If sub_path is provided, concatenate it to the mapped path
        if ($subPath !== null && $subPath !== '') {
            // Remove leading slash from sub_path if present to avoid double slashes
            $subPath = ltrim($subPath, '/');
            $mappedPath = rtrim($mappedPath, '/') . '/' . $subPath;
        }
        
        return $mappedPath;
    }

    /**
     * Get base data directory (PHP version of get_base_data_directory)
     * Priority: WSL /mnt/d -> NTFS mount -> Data disk mount -> /www
     */
    private static function getBaseDataDirectory(): string
    {
        // Priority 1: WSL /mnt/d
        if (self::isWSL()) {
            return '/mnt/d';
        }
        
        // Priority 2: Check for NTFS or data disk mounts
        // For PHP, we'll check common mount points
        $commonMounts = ['/mnt/d', '/mnt/e', '/data', '/www'];
        foreach ($commonMounts as $mount) {
            if (is_dir($mount) && is_writable($mount)) {
                return $mount;
            }
        }
        
        // Fallback: /www
        return '/www';
    }

    /**
     * Check if running in WSL environment
     * Detects WSL by checking for /mnt/c/Users directory
     */
    public static function isWSL(): bool
    {
        // Primary check: /mnt/c/Users directory exists (Windows user directory in WSL)
        if (is_dir('/mnt/c/Users')) {
            return true;
        }
        
        // Check for WSL indicators in /proc/version
        if (file_exists('/proc/version')) {
            $version = file_get_contents('/proc/version');
            if (stripos($version, 'microsoft') !== false || stripos($version, 'wsl') !== false) {
                return true;
            }
        }
        
        // Check for WSL environment variable
        if (getenv('WSL_DISTRO_NAME') !== false) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if running in production environment
     * Production = not WSL and not desktop environment
     */
    public static function isProduction(): bool
    {
        // If WSL, not production
        if (self::isWSL()) {
            return false;
        }
        
        // Check for desktop environment
        if (self::hasDesktopEnvironment()) {
            return false;
        }
        
        // Not WSL and not desktop = production
        return true;
    }

    /**
     * Check if system has desktop environment
     */
    public static function hasDesktopEnvironment(): bool
    {
        // Check for X11 session
        if (getenv('DISPLAY') && getenv('DISPLAY') !== ':0') {
            return true;
        }
        
        // Check for Wayland session
        if (getenv('WAYLAND_DISPLAY')) {
            return true;
        }
        
        // Check for desktop environment variables
        if (getenv('XDG_CURRENT_DESKTOP') || getenv('DESKTOP_SESSION')) {
            return true;
        }
        
        // Check for common desktop processes (if we can execute commands)
        if (function_exists('exec')) {
            $output = [];
            $returnVar = 0;
            @exec('pgrep -x "gnome-session|kde-session|xfce4-session|mate-session|cinnamon-session" 2>/dev/null', $output, $returnVar);
            if (!empty($output)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find actual path for system directories (nginx, php)
     * Returns the path if it exists, otherwise returns the default
     */
    private static function findActualPath(string $defaultPath): string
    {
        if (is_dir($defaultPath)) {
            return $defaultPath;
        }
        
        // Try common alternative locations
        $alternatives = [
            '/usr/local/nginx/conf',
            '/opt/nginx/conf',
            '/usr/local/etc/nginx',
        ];
        
        foreach ($alternatives as $alt) {
            if (is_dir($alt)) {
                return $alt;
            }
        }
        
        return $defaultPath;
    }

    /**
     * Find Laravel log path
     * Maps to laravel_data_dir/log (laravel_db/log)
     */
    private static function findLaravelLogPath(string $basePath): string
    {
        $laravelDataDir = $basePath . '/wwwroot/laravel_db';
        $logPath = $laravelDataDir . '/log';
        
        // If log directory doesn't exist, try to create it
        if (!is_dir($logPath)) {
            // Try to create parent directory first
            if (!is_dir($laravelDataDir)) {
                @mkdir($laravelDataDir, 0755, true);
            }
            // Create log directory
            @mkdir($logPath, 0755, true);
        }
        
        // If still doesn't exist, fallback to /var/log
        if (!is_dir($logPath)) {
            return '/var/log';
        }
        
        return $logPath;
    }

    // ==========================================
    // Database Path Helper Methods
    // ==========================================

    /**
     * Get www root directory
     */
    public static function getWwwRoot(): string
    {
        return self::mapWebPath('wwwroot');
    }

    /**
     * Get Laravel public path
     */
    public static function getLaravelPublicPath(): string
    {
        $wwwRoot = self::getWwwRoot();
        return $wwwRoot . '/laravel_main';
    }

    /**
     * Get Laravel database directory
     */
    public static function getLaravelDatabaseDir(): string
    {
        // Use mapped laravel_data_dir
        return self::mapWebPath('laravel_data_dir');
    }

    /**
     * Get Laravel sessions directory (within laravel_db)
     */
    public static function getLaravelSessionsDir(): string
    {
        return self::getLaravelDatabaseDir() . '/sessions';
    }

    /**
     * Get Laravel tmp directory (within laravel_db)
     */
    public static function getLaravelTmpDir(): string
    {
        return self::getLaravelDatabaseDir() . '/tmp';
    }

    /**
     * Get default database path
     */
    public static function getDefaultDatabasePath(string $databaseName = 'database.sqlite'): string
    {
        $defaultDatabasePath = env('DB_DATABASE');
        $laravelDatabaseDir = self::getLaravelDatabaseDir();

        if ($defaultDatabasePath == "" || $defaultDatabasePath == null) {
            $defaultDatabasePath = $laravelDatabaseDir;
        }

        if (!file_exists($defaultDatabasePath)) {
            mkdir($defaultDatabasePath, 0755, true);
        }

        return $defaultDatabasePath . '/' . $databaseName;
    }

    // ==========================================
    // Web Path Helper Methods
    // ==========================================

    /**
     * Get nginx config directory
     */
    public static function getNginxConfig(): string
    {
        return self::mapWebPath('nginxconfig');
    }

    /**
     * Get SSL certificate directory
     */
    public static function getSSLDir(): string
    {
        return self::mapWebPath('nginxconfig', 'ssl');
    }

    /**
     * Get sites-available directory
     */
    public static function getSitesAvailable(): string
    {
        return self::mapWebPath('nginxconfig', 'sites-available');
    }

    /**
     * Get sites-enabled directory
     */
    public static function getSitesEnabled(): string
    {
        return self::mapWebPath('nginxconfig', 'sites-enabled');
    }

    /**
     * Get shared data directory
     */
    public static function getSharedData(): string
    {
        return self::mapWebPath('shared-data');
    }

    /**
     * Get backup directory
     */
    public static function getBackupDir(): string
    {
        return self::mapWebPath('backup');
    }

    // ==========================================
    // External Storage Helper Methods
    // ==========================================

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
    public static function getExternalStoragePath(string $type): string
    {
        $os = self::getOS();
        $config = config("storage.external.{$type}");
        
        if (!$config || !isset($config[$os])) {
            // Fallback to mapped paths
            return match($type) {
                'upload' => self::mapWebPath('wwwroot', 'laravel_main/uploads'),
                'static' => self::mapWebPath('wwwroot', 'laravel_main/static'),
                'backup' => self::mapWebPath('backup'),
                'cache' => self::mapWebPath('wwwroot', 'laravel_main/cache'),
                'updates' => self::mapWebPath('wwwroot', 'laravel_main/updates'),
                'logs' => self::mapWebPath('logs'),
                'temp' => sys_get_temp_dir(),
                default => throw new \InvalidArgumentException("External storage path not configured for type '{$type}' on OS '{$os}'")
            };
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
        return self::getExternalStoragePath('upload');
    }

    /**
     * Get static files directory path
     */
    public static function getStaticPath(): string
    {
        return self::getExternalStoragePath('static');
    }

    /**
     * Get backup directory path (external storage)
     */
    public static function getExternalBackupPath(): string
    {
        return self::getExternalStoragePath('backup');
    }

    /**
     * Get cache directory path
     */
    public static function getCachePath(): string
    {
        return self::getExternalStoragePath('cache');
    }

    /**
     * Get updates directory path
     */
    public static function getUpdatesPath(): string
    {
        return self::getExternalStoragePath('updates');
    }

    /**
     * Get logs directory path (external storage)
     */
    public static function getExternalLogsPath(): string
    {
        return self::getExternalStoragePath('logs');
    }

    /**
     * Get temp directory path
     */
    public static function getTempPath(): string
    {
        return self::getExternalStoragePath('temp');
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
                Log::info("Created directory: {$path}");
            }
            
            if (!is_writable($path)) {
                Log::warning("Directory is not writable: {$path}");
                return false;
            }
            
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to create directory: {$path}", [
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
        $basePath = self::getExternalStoragePath($type);
        
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
        $basePath = self::getExternalStoragePath($type);
        return trim(str_replace([$basePath, '\\'], ['', '/'], $fullPath), '/');
    }

    /**
     * Check if a path is within external storage
     */
    public static function isWithinExternalStorage(string $type, string $path): bool
    {
        $basePath = self::getExternalStoragePath($type);
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
    public static function getAllExternalStoragePaths(): array
    {
        return [
            'upload' => self::getUploadPath(),
            'static' => self::getStaticPath(),
            'backup' => self::getExternalBackupPath(),
            'cache' => self::getCachePath(),
            'updates' => self::getUpdatesPath(),
            'logs' => self::getExternalLogsPath(),
            'temp' => self::getTempPath(),
        ];
    }

    /**
     * Validate all external storage paths
     */
    public static function validateExternalStoragePaths(): array
    {
        $results = [];
        $paths = self::getAllExternalStoragePaths();
        
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

    // ==========================================
    // Utility Methods
    // ==========================================

    /**
     * Validate that a path exists and is writable
     */
    public static function validatePath(string $path): array
    {
        $result = [
            'exists' => false,
            'isDirectory' => false,
            'isWritable' => false,
            'isReadable' => false,
            'error' => null
        ];

        if (file_exists($path)) {
            $result['exists'] = true;

            if (is_dir($path)) {
                $result['isDirectory'] = true;
                $result['isWritable'] = is_writable($path);
                $result['isReadable'] = is_readable($path);
            } else {
                $result['error'] = 'Path exists but is not a directory';
            }
        } else {
            $result['error'] = 'Path does not exist';
        }

        return $result;
    }

    /**
     * Ensure a directory exists with proper permissions
     */
    public static function ensureDirectory(string $path, int $permissions = 0755): bool
    {
        if (!is_dir($path)) {
            if (!mkdir($path, $permissions, true)) {
                return false;
            }
        }

        // Try to set permissions (may fail in WSL)
        @chmod($path, $permissions);

        return is_dir($path);
    }

    /**
     * Get path diagnostics for debugging
     */
    public static function getDiagnostics(): array
    {
        return [
            'environment' => [
                'isWsl' => self::isWSL(),
                'isProduction' => self::isProduction(),
                'hasDesktop' => self::hasDesktopEnvironment(),
                'osFamily' => PHP_OS_FAMILY,
                'baseDataDir' => self::getBaseDataDirectory(),
            ],
            'paths' => [
                'wwwroot' => self::getWwwRoot(),
                'nginxconfig' => self::getNginxConfig(),
                'ssl' => self::getSSLDir(),
                'sites_available' => self::getSitesAvailable(),
                'sites_enabled' => self::getSitesEnabled(),
                'shared_data' => self::getSharedData(),
                'backup' => self::getBackupDir(),
                'laravel_data_dir' => self::getLaravelDatabaseDir(),
                'logs' => self::mapWebPath('logs'),
                'core_node_dir' => self::getCoreNodeDir(),
            ],
            'validation' => [
                'wwwroot' => self::validatePath(self::getWwwRoot()),
                'nginxconfig' => self::validatePath(self::getNginxConfig()),
                'ssl' => self::validatePath(self::getSSLDir()),
                'sites_available' => self::validatePath(self::getSitesAvailable()),
            ],
            'external_storage' => self::getAllExternalStoragePaths(),
        ];
    }

    // ==========================================
    // Core Node Directory Methods
    // ==========================================

    /**
     * Get core_node directory path
     * Uses absolute path based on current file location
     * 
     * @return string|null The path to core_node directory
     */
    public static function getCoreNodeDir(): ?string
    {
        static $cachedPath = null;
        
        if ($cachedPath !== null) {
            return $cachedPath;
        }
        
        // Start from PathMapper file location
        // PathMapper is at: core_node/poly_apps/laravel_main/app/Providers/PathMapper.php
        // Need to go up 5 levels: Providers -> app -> laravel_main -> poly_apps -> core_node
        $currentFile = __FILE__;
        $currentDir = dirname($currentFile);
        
        // Go up 5 levels to reach core_node
        $coreNodeDir = $currentDir;
        for ($i = 0; $i < 5; $i++) {
            $coreNodeDir = dirname($coreNodeDir);
        }
        
        $cachedPath = $coreNodeDir;
        return $cachedPath;
    }
    
    /**
     * Get Laravel main directory path
     * Uses relative positioning from PathMapper file location
     * 
     * PathMapper is at: core_node/poly_apps/laravel_main/app/Providers/PathMapper.php
     * Laravel main is at: core_node/poly_apps/laravel_main
     * Need to go up 2 levels: Providers -> app -> laravel_main
     * 
     * @return string The path to laravel_main directory
     */
    public static function getLaravelMainDir(): string
    {
        static $cachedPath = null;
        
        if ($cachedPath !== null) {
            return $cachedPath;
        }
        
        // Start from PathMapper file location
        // PathMapper is at: core_node/poly_apps/laravel_main/app/Providers/PathMapper.php
        // Need to go up 2 levels: Providers -> app -> laravel_main
        $currentFile = __FILE__;
        $currentDir = dirname($currentFile);
        
        // Go up 2 levels to reach laravel_main
        $laravelMainDir = $currentDir;
        for ($i = 0; $i < 2; $i++) {
            $laravelMainDir = dirname($laravelMainDir);
        }
        
        $cachedPath = $laravelMainDir;
        return $cachedPath;
    }
    
    /**
     * Get Laravel main public directory path
     * Uses getLaravelMainDir() for relative positioning
     * 
     * @return string The path to laravel_main/public directory
     */
    public static function getLaravelMainPublicDir(): string
    {
        return self::getLaravelMainDir() . '/public';
    }
}

