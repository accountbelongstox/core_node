<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;

class ServerManagerV1PathResolver
{
    private static ?array $environment = null;

    /**
     * Get core_node root directory from current file path
     * Current file: core_node/poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1PathResolver.php
     * Need to go up: ../../../../../../.. to reach core_node
     */
    private static function resolveCoreNodePath(): string
    {
        $currentFile = __FILE__;
        $coreNodePath = realpath(dirname($currentFile) . '/../../../../../../..');

        // Normalize path separators to forward slashes for consistency
        $coreNodePath = str_replace('\\', '/', $coreNodePath);

        // Convert Windows paths to WSL paths if needed
        // Example: D:/programing/core_node -> /mnt/d/programing/core_node
        if (preg_match('/^([A-Z]):(.*)$/i', $coreNodePath, $matches)) {
            $drive = strtolower($matches[1]);
            $path = $matches[2];
            $coreNodePath = "/mnt/$drive$path";
        }

        return $coreNodePath;
    }

    /**
     * Detect current environment
     */
    public static function detectEnvironment(): array
    {
        if (self::$environment !== null) {
            return self::$environment;
        }

        $coreNodePath = self::resolveCoreNodePath();

        // WSL detection: check if path starts with /mnt/
        $isWsl = (strpos($coreNodePath, '/mnt/d/') === 0 || strpos($coreNodePath, '/mnt/c/') === 0);

        // Production detection: check if path is under /www/wwwroot/
        $isProduction = (strpos($coreNodePath, '/www/wwwroot/') === 0);

        // Windows detection: check directory separator (but could still be WSL)
        $isWindows = DIRECTORY_SEPARATOR === '\\';

        self::$environment = [
            'is_wsl' => $isWsl,
            'is_production' => $isProduction,
            'is_windows' => $isWindows,
            'core_node_path' => $coreNodePath,
            'environment_name' => $isWsl ? 'WSL Test Environment' : ($isProduction ? 'Production' : ($isWindows ? 'Windows' : 'Development')),
            'os_type' => PHP_OS_FAMILY,
            'php_version' => PHP_VERSION,
            'current_file' => __FILE__,
            'resolved_path' => $coreNodePath
        ];

        Log::info('ServerManagerV1: Environment detected', self::$environment);

        return self::$environment;
    }

    /**
     * Get core node root path
     */
    public static function getCoreNodePath(): string
    {
        $env = self::detectEnvironment();
        return $env['core_node_path'];
    }

    /**
     * Get secret keys directory
     */
    public static function getSecretKeysPath(): string
    {
        return self::getCoreNodePath() . '/.secret_keys/.secret_ignore';
    }

    /**
     * Get dd.sh script path
     */
    public static function getDdScriptPath(): string
    {
        return self::getCoreNodePath() . '/scripts/dd.sh';
    }

    /**
     * Check if running in WSL
     */
    public static function isWSL(): bool
    {
        $env = self::detectEnvironment();
        return $env['is_wsl'];
    }

    /**
     * Get environment info as string
     */
    public static function getEnvironmentInfo(): string
    {
        $env = self::detectEnvironment();

        $info = "=== Environment Detection ===\n";
        $info .= "Environment: {$env['environment_name']}\n";
        $info .= "Core Node Path: {$env['core_node_path']}\n";
        $info .= "OS Type: {$env['os_type']}\n";
        $info .= "PHP Version: {$env['php_version']}\n";

        if ($env['is_wsl']) {
            $info .= "\n⚠️  WSL TEST ENVIRONMENT DETECTED\n";
            $info .= "This is a Windows Subsystem for Linux testing environment.\n";
            $info .= "Some operations may have limited functionality.\n";
        }

        return $info;
    }

    /**
     * Map web path based on environment (matches gvar_common.sh logic)
     * In WSL, check if Windows directories exist first; if they exist, use them
     * If Windows directories don't exist, use Linux paths
     * In Production, use standard Linux paths
     *
     * @param string $linuxPath The Linux path to map
     * @return string The mapped path
     */
    public static function mapWebPath(string $linuxPath): string
    {
        if (!self::isWSL()) {
            // Production: return as-is
            return $linuxPath;
        }

        // WSL: Map web server paths to Windows directories if they exist
        if (strpos($linuxPath, '/www/wwwroot') === 0) {
            // Check if D:\wwwroot\ exists in WSL (not D:\www\wwwroot\)
            if (is_dir('/mnt/d/wwwroot')) {
                return '/mnt/d/wwwroot' . substr($linuxPath, strlen('/www/wwwroot'));
            }
        } elseif (strpos($linuxPath, '/www/nginxconfig') === 0) {
            // Check if D:\nginxconfig\ exists in WSL
            if (is_dir('/mnt/d/nginxconfig')) {
                return '/mnt/d/nginxconfig' . substr($linuxPath, strlen('/www/nginxconfig'));
            }
        } elseif (strpos($linuxPath, '/www/shared-data') === 0) {
            // Check if D:\shared-data\ exists in WSL
            if (is_dir('/mnt/d/shared-data')) {
                return '/mnt/d/shared-data' . substr($linuxPath, strlen('/www/shared-data'));
            }
        } elseif (strpos($linuxPath, '/www/backup') === 0) {
            // Check if D:\backup\ exists in WSL
            if (is_dir('/mnt/d/backup')) {
                return '/mnt/d/backup' . substr($linuxPath, strlen('/www/backup'));
            }
        } elseif (preg_match('#^/www/dev_#', $linuxPath)) {
            // Check if D:\www\ parent exists in WSL
            if (is_dir('/mnt/d/www')) {
                return '/mnt/d' . $linuxPath;
            }
        }

        // Keep system config in Linux filesystem even in WSL
        // /etc/nginx, /etc/php, /var/log remain unmapped

        // Default: no mapping (use Linux path)
        return $linuxPath;
    }

    /**
     * Ensure web directory exists with proper path mapping
     *
     * @param string $linuxPath The Linux path
     * @param int $permissions The directory permissions (octal)
     * @return string The actual created path
     */
    public static function ensureWebDirectory(string $linuxPath, int $permissions = 0755): string
    {
        // Map to appropriate path
        $actualPath = self::mapWebPath($linuxPath);

        // Create directory if it doesn't exist
        if (!is_dir($actualPath)) {
            Log::info("Creating directory: $actualPath (mapped from $linuxPath)");
            mkdir($actualPath, $permissions, true);
        }

        // Set permissions
        chmod($actualPath, $permissions);

        return $actualPath;
    }

    /**
     * Resolve web directory path based on environment
     * Maps /www/wwwroot to Windows directories in WSL if they exist
     */
    public static function resolveWebRoot(): string
    {
        return self::mapWebPath('/www/wwwroot');
    }

    /**
     * Get nginx paths based on environment
     * Maps /www/nginxconfig to Windows directories in WSL if they exist
     */
    public static function getNginxPaths(): array
    {
        $linuxConfigPath = '/www/nginxconfig/sites-available';
        $linuxEnabledPath = '/www/nginxconfig/sites-enabled';

        if (self::isWSL()) {
            // Check if Windows D:\nginxconfig exists
            if (is_dir('/mnt/d/nginxconfig')) {
                return [
                    'config_path' => '/mnt/d/nginxconfig/sites-available',
                    'enabled_path' => '/mnt/d/nginxconfig/sites-enabled',
                    'available' => is_dir('/mnt/d/nginxconfig/sites-available'),
                    'note' => 'WSL environment - using Windows D:\nginxconfig'
                ];
            }

            // Use /etc/nginx in WSL if Windows directory doesn't exist
            return [
                'config_path' => '/etc/nginx/sites-available',
                'enabled_path' => '/etc/nginx/sites-enabled',
                'available' => file_exists('/etc/nginx/sites-available'),
                'note' => 'WSL environment - using /etc/nginx (nginx may not be installed)'
            ];
        }

        // Production: use /www/nginxconfig if it exists, otherwise /etc/nginx
        if (is_dir('/www/nginxconfig')) {
            return [
                'config_path' => $linuxConfigPath,
                'enabled_path' => $linuxEnabledPath,
                'available' => is_dir($linuxConfigPath),
                'note' => 'Production environment - using /www/nginxconfig'
            ];
        }

        return [
            'config_path' => '/etc/nginx/sites-available',
            'enabled_path' => '/etc/nginx/sites-enabled',
            'available' => file_exists('/etc/nginx/sites-available'),
            'note' => 'Production environment - using /etc/nginx'
        ];
    }

    /**
     * Check if path exists and print debug info
     */
    public static function debugPath(string $label, string $path): array
    {
        $exists = file_exists($path);
        $isDir = is_dir($path);
        $isFile = is_file($path);
        $readable = is_readable($path);
        $writable = is_writable($path);

        return [
            'label' => $label,
            'path' => $path,
            'exists' => $exists,
            'is_dir' => $isDir,
            'is_file' => $isFile,
            'readable' => $readable,
            'writable' => $writable
        ];
    }
}
