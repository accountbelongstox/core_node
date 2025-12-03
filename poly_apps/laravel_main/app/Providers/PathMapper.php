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

            // Script paths
            'scripts_dir' => self::getCoreNodeDir() . '/scripts',
            'shells_dir' => self::getCoreNodeDir() . '/scripts/shells',
            'linux_shells_dir' => self::getCoreNodeDir() . '/scripts/shells/linux',
            'debian_shells_dir' => self::getCoreNodeDir() . '/scripts/shells/linux/debian',
            'install_shells_dir' => self::getCoreNodeDir() . '/scripts/shells/linux/debian/install_shells',
            'common_shells_dir' => self::getCoreNodeDir() . '/scripts/shells/linux/common',
            'dd_helper_dir' => self::getCoreNodeDir() . '/scripts/shells/linux/dd_helper',

            // System paths - Binary symlinks
            'node_symlink' => '/usr/local/bin/node',
            'go_symlink' => '/usr/local/bin/go',
            'flutter_symlink' => '/usr/local/bin/flutter',

            // System paths - System directories
            'systemd_dir' => '/etc/systemd/system',
            'systemd_bin' => '/usr/bin/systemctl',

            default => $pathKey,
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

    private static $hasDesktopEnvironmentCached = null;

    /**
     * Check if system has desktop environment
     */
    public static function hasDesktopEnvironment(): bool
    {
        if (self::$hasDesktopEnvironmentCached !== null) {
            return self::$hasDesktopEnvironmentCached;
        }

        if (isset($_SERVER['INVOCATION_ID'])) {
            self::$hasDesktopEnvironmentCached = false;
            return false;
        }

        if (getenv('DISPLAY') && getenv('DISPLAY') !== ':0') {
            self::$hasDesktopEnvironmentCached = true;
            return true;
        }

        if (getenv('WAYLAND_DISPLAY')) {
            self::$hasDesktopEnvironmentCached = true;
            return true;
        }

        if (getenv('XDG_CURRENT_DESKTOP') || getenv('DESKTOP_SESSION')) {
            self::$hasDesktopEnvironmentCached = true;
            return true;
        }

        self::$hasDesktopEnvironmentCached = false;
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
        return self::mapWebPath('laravel_data_dir');
    }

    /**
     * Get Laravel database directory
     */
    public static function getLaravelDatabaseDir(): string
    {
        return self::mapWebPath('laravel_data_dir');
    }

    /**
     * Get Laravel data directory (alias for getLaravelDatabaseDir)
     */
    public static function getLaravelDataDir(): string
    {
        return self::getLaravelDatabaseDir();
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

    public static function getLaravelAvatarsDir(): string
    {
        return self::getLaravelDatabaseDir() . '/avatars';
    }

    public static function getLaravelUploadsDir(): string
    {
        return self::getLaravelDatabaseDir() . '/uploads';
    }

    public static function getLaravelStaticDir(): string
    {
        return self::getLaravelDatabaseDir() . '/static';
    }

    public static function getLaravelCacheDir(): string
    {
        return self::getLaravelDatabaseDir() . '/cache';
    }

    public static function getLaravelLogsDir(): string
    {
        return self::getLaravelDatabaseDir() . '/logs';
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
        // Need to go up 4 levels: Providers -> app -> laravel_main -> poly_apps -> core_node
        $currentFile = __FILE__;
        $currentDir = dirname($currentFile);

        // Go up 4 levels to reach core_node
        $coreNodeDir = $currentDir;
        for ($i = 0; $i < 4; $i++) {
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

    // ==========================================
    // Script Directory Methods
    // ==========================================

    /**
     * Get scripts directory
     */
    public static function getScriptsDir(): string
    {
        return self::mapWebPath('scripts_dir');
    }

    /**
     * Get shells directory
     */
    public static function getShellsDir(): string
    {
        return self::mapWebPath('shells_dir');
    }

    /**
     * Get Linux shells directory
     */
    public static function getLinuxShellsDir(): string
    {
        return self::mapWebPath('linux_shells_dir');
    }

    /**
     * Get Debian shells directory
     */
    public static function getDebianShellsDir(): string
    {
        return self::mapWebPath('debian_shells_dir');
    }

    /**
     * Get install shells directory
     */
    public static function getInstallShellsDir(): string
    {
        return self::mapWebPath('install_shells_dir');
    }

    /**
     * Get common shells directory
     */
    public static function getCommonShellsDir(): string
    {
        return self::mapWebPath('common_shells_dir');
    }

    /**
     * Get dd helper directory
     */
    public static function getDdHelperDir(): string
    {
        return self::mapWebPath('dd_helper_dir');
    }

    /**
     * Get node installation script path
     */
    public static function getNodeInstallScript(): string
    {
        return self::getInstallShellsDir() . '/14_install_node_22.sh';
    }

    /**
     * Get Go installation script path
     */
    public static function getGoInstallScript(): string
    {
        return self::getInstallShellsDir() . '/53_install_golang22.sh';
    }

    /**
     * Get Flutter installation script path
     */
    public static function getFlutterInstallScript(): string
    {
        return self::getInstallShellsDir() . '/38_install_flutter.sh';
    }

    // ==========================================
    // Binary Path Detection Methods
    // ==========================================

    /**
     * Get Node binary path
     * Follows the installation script pattern from 14_install_node_22.sh
     *
     * Priority:
     * 1. Symlink at /usr/local/bin/node (created by installation script)
     * 2. NODE_HOME environment variable + /bin/node
     * 3. which node command
     * 4. Fallback to symlink path
     *
     * @return string Path to node binary
     */
    public static function getNodeBinaryPath(): string
    {
        $symlinkPath = self::mapWebPath('node_symlink');
        if (file_exists($symlinkPath)) {
            return $symlinkPath;
        }

        $nodeHome = getenv('NODE_HOME');
        if ($nodeHome && file_exists("$nodeHome/bin/node")) {
            return "$nodeHome/bin/node";
        }

        $result = \Illuminate\Support\Facades\Process::run('which node');
        if ($result->successful()) {
            $nodePath = trim($result->output());
            if (!empty($nodePath) && file_exists($nodePath)) {
                return $nodePath;
            }
        }

        return $symlinkPath;
    }

    /**
     * Get Go binary path
     * Follows the installation script pattern from 53_install_golang22.sh
     *
     * Priority:
     * 1. Symlink at /usr/local/bin/go (created by installation script)
     * 2. $COMPILE_DIR/go/bin/go (GO_DIR from installation script)
     * 3. which go command
     * 4. Fallback to symlink path
     *
     * @return string Path to go binary
     */
    public static function getGoBinaryPath(): string
    {
        $symlinkPath = self::mapWebPath('go_symlink');
        if (file_exists($symlinkPath)) {
            return $symlinkPath;
        }

        $compileDir = self::mapWebPath('compile_dir');
        $goBin = "$compileDir/go/bin/go";
        if (file_exists($goBin)) {
            return $goBin;
        }

        $result = \Illuminate\Support\Facades\Process::run('which go');
        if ($result->successful()) {
            $goPath = trim($result->output());
            if (!empty($goPath) && file_exists($goPath)) {
                return $goPath;
            }
        }

        return $symlinkPath;
    }

    /**
     * Get Flutter binary path
     * Follows the installation script pattern from 38_install_flutter.sh
     *
     * Priority:
     * 1. Symlink at /usr/local/bin/flutter (created by installation script)
     * 2. Snap installation at /snap/bin/flutter
     * 3. which flutter command
     * 4. Fallback to symlink path
     *
     * @return string Path to flutter binary
     */
    public static function getFlutterBinaryPath(): string
    {
        $symlinkPath = self::mapWebPath('flutter_symlink');
        if (file_exists($symlinkPath)) {
            return $symlinkPath;
        }

        $snapPath = '/snap/bin/flutter';
        if (file_exists($snapPath)) {
            return $snapPath;
        }

        $result = \Illuminate\Support\Facades\Process::run('which flutter');
        if ($result->successful()) {
            $flutterPath = trim($result->output());
            if (!empty($flutterPath) && file_exists($flutterPath)) {
                return $flutterPath;
            }
        }

        return $symlinkPath;
    }

    /**
     * Get PHP binary path
     * Follows PHP installation patterns
     *
     * Priority:
     * 1. /usr/local/bin/php (most common for compiled PHP)
     * 2. /usr/bin/php (system package manager installation)
     * 3. which php command
     * 4. Fallback to /usr/local/bin/php
     *
     * @return string Path to php binary
     */
    public static function getPhpBinaryPath(): string
    {
        $commonPaths = [
            '/usr/local/bin/php',
            '/usr/bin/php',
        ];

        foreach ($commonPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which php');
        if ($result->successful()) {
            $phpPath = trim($result->output());
            if (!empty($phpPath) && file_exists($phpPath)) {
                return $phpPath;
            }
        }

        return '/usr/local/bin/php';
    }

    /**
     * Get nginx binary path
     *
     * Priority:
     * 1. /usr/sbin/nginx (standard Debian/Ubuntu location)
     * 2. /usr/bin/nginx (alternative location)
     * 3. /usr/local/bin/nginx (custom installation)
     * 4. which nginx command
     * 5. Fallback to 'nginx' (let system PATH resolve)
     *
     * @return string Path to nginx binary
     */
    public static function getNginxBinaryPath(): string
    {
        $possiblePaths = [
            '/usr/sbin/nginx',
            '/usr/bin/nginx',
            '/usr/local/bin/nginx',
        ];

        foreach ($possiblePaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which nginx');
        if ($result->successful()) {
            $nginxPath = trim($result->output());
            if (!empty($nginxPath) && file_exists($nginxPath)) {
                return $nginxPath;
            }
        }

        return 'nginx';
    }

    /**
     * Get pnpm binary path
     *
     * Priority:
     * 1. /usr/local/bin/pnpm (most common installation)
     * 2. which pnpm command
     * 3. Fallback to 'pnpm' (let system PATH resolve)
     *
     * @return string Path to pnpm binary
     */
    public static function getPnpmBinaryPath(): string
    {
        $commonPath = '/usr/local/bin/pnpm';
        if (file_exists($commonPath) && is_executable($commonPath)) {
            return $commonPath;
        }

        $result = \Illuminate\Support\Facades\Process::run('which pnpm');
        if ($result->successful()) {
            $pnpmPath = trim($result->output());
            if (!empty($pnpmPath) && file_exists($pnpmPath)) {
                return $pnpmPath;
            }
        }

        return 'pnpm';
    }

    /**
     * Get pdftk binary path
     *
     * Priority:
     * 1. /usr/bin/pdftk (system package manager installation)
     * 2. /usr/local/bin/pdftk (compiled installation)
     * 3. which pdftk command
     * 4. Fallback to null if not found
     *
     * @return string|null Path to pdftk binary or null if not found
     */
    public static function getPdftkBinaryPath(): ?string
    {
        $commonPaths = [
            '/usr/bin/pdftk',
            '/usr/local/bin/pdftk',
        ];

        foreach ($commonPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which pdftk');
        if ($result->successful()) {
            $pdftkPath = trim($result->output());
            if (!empty($pdftkPath) && file_exists($pdftkPath)) {
                return $pdftkPath;
            }
        }

        return null;
    }

    /**
     * Get Ghostscript binary path
     *
     * Priority:
     * 1. /usr/bin/gs (system package manager installation)
     * 2. /usr/local/bin/gs (compiled installation)
     * 3. which gs command
     * 4. Fallback to null if not found
     *
     * @return string|null Path to gs binary or null if not found
     */
    public static function getGhostscriptBinaryPath(): ?string
    {
        $commonPaths = [
            '/usr/bin/gs',
            '/usr/local/bin/gs',
        ];

        foreach ($commonPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which gs');
        if ($result->successful()) {
            $gsPath = trim($result->output());
            if (!empty($gsPath) && file_exists($gsPath)) {
                return $gsPath;
            }
        }

        return null;
    }
}

