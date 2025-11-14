<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use App\Providers\PathMapper;

class ServerManagerV1PathResolver
{
    private static ?array $environment = null;

    /**
     * Detect current environment
     */
    public static function detectEnvironment(): array
    {
        if (self::$environment !== null) {
            return self::$environment;
        }

        $coreNodePath = PathMapper::getCoreNodeDir() ?? '';

        // WSL detection: check if path starts with /mnt/
        $isWsl = PathMapper::isWSL();

        // Production detection
        $isProduction = PathMapper::isProduction();

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
     * @deprecated Use PathMapper::getCoreNodeDir() instead
     */
    public static function getCoreNodePath(): string
    {
        return PathMapper::getCoreNodeDir() ?? '';
    }

    /**
     * Get secret keys directory
     * @deprecated Use PathMapper::getCoreNodeDir() . '/.secret_keys/.secret_ignore' instead
     */
    public static function getSecretKeysPath(): string
    {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        return $coreNodeDir ? $coreNodeDir . '/.secret_keys/.secret_ignore' : '';
    }

    /**
     * Get dd.sh script path
     * @deprecated Use PathMapper::getCoreNodeDir() . '/scripts/dd.sh' instead
     */
    public static function getDdScriptPath(): string
    {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        return $coreNodeDir ? $coreNodeDir . '/scripts/dd.sh' : '';
    }

    /**
     * Check if running in WSL
     * @deprecated Use PathMapper::isWSL() instead
     */
    public static function isWSL(): bool
    {
        return PathMapper::isWSL();
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
     * @deprecated Use PathMapper::mapWebPath() instead
     */
    /**
     * Map web path from hardcoded Linux path to environment-aware path
     * 
     * @deprecated This method is for backwards compatibility only.
     * New code should use PathMapper::mapWebPath() directly with path keys.
     * This method checks for hardcoded paths like /www/wwwroot, /www/nginxconfig, etc.
     * and converts them to use PathMapper for environment-aware resolution.
     */
    public static function mapWebPath(string $linuxPath): string
    {
        // Extract path key from linuxPath (for backwards compatibility with hardcoded paths)
        // NOTE: New code should NOT use hardcoded paths like /www/wwwroot
        // Instead, use PathMapper::mapWebPath('wwwroot', $subPath) directly
        if (strpos($linuxPath, '/www/wwwroot') === 0) {
            $subPath = substr($linuxPath, strlen('/www/wwwroot'));
            return PathMapper::mapWebPath('wwwroot', $subPath);
        } elseif (strpos($linuxPath, '/www/nginxconfig') === 0) {
            $subPath = substr($linuxPath, strlen('/www/nginxconfig'));
            return PathMapper::mapWebPath('nginxconfig', $subPath);
        } elseif (strpos($linuxPath, '/www/shared-data') === 0) {
            $subPath = substr($linuxPath, strlen('/www/shared-data'));
            return PathMapper::mapWebPath('shared-data', $subPath);
        } elseif (strpos($linuxPath, '/www/backup') === 0) {
            $subPath = substr($linuxPath, strlen('/www/backup'));
            return PathMapper::mapWebPath('backup', $subPath);
        }
        
        // For other paths, return as-is
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
     * @deprecated Use PathMapper::mapWebPath('wwwroot') instead
     */
    public static function resolveWebRoot(): string
    {
        return PathMapper::mapWebPath('wwwroot');
    }

    /**
     * Get nginx paths based on environment
     * @deprecated Use ServerManagerV1PathConfig methods instead
     */
    public static function getNginxPaths(): array
    {
        $nginxConfigDir = PathMapper::mapWebPath('nginxconfig');
        $sitesAvailable = $nginxConfigDir . '/sites-available';
        $sitesEnabled = $nginxConfigDir . '/sites-enabled';
        
        return [
            'config_path' => $sitesAvailable,
            'enabled_path' => $sitesEnabled,
            'available' => is_dir($sitesAvailable),
            'note' => 'Using mapped nginx config directory'
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
