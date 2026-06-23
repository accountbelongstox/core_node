<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Helpers;

/**
 * Web Path Helper - Matches gvar_common.sh map_web_path() logic
 *
 * This helper ensures that Laravel applications use the same path mapping
 * logic as the gvar_common.sh bash scripts, maintaining consistency
 * across the entire system.
 *
 * IMPORTANT: When modifying path logic, also update:
 * - /mnt/dev_sdb3/programing/core_node/scripts/shells/linux/common/gvar_common.sh
 * - DatabasePathHelper.php
 * - All related configuration files
 */
class WebPathHelper
{
    /**
     * Get optimal base data directory (matches get_base_data_directory in gvar_common.sh)
     */
    private static function getBaseDataDirectory(): string
    {
        // Check if we're in WSL environment
        if (PHP_OS_FAMILY === 'Windows') {
            return 'D:';
        }

        // Check for mounted data disk
        if (is_dir('/mnt/d')) {
            return '/mnt/d';
        }

        if (is_dir('/mnt/data')) {
            return '/mnt/data';
        }

        // Fallback to /usr for production
        if (is_dir('/usr')) {
            return '/usr';
        }

        return '/mnt/dev_sdb3'; // Last resort
    }

    /**
     * Check if this is a WSL environment
     */
    private static function isWsl(): bool
    {
        // Check for WSL indicators
        return PHP_OS_FAMILY === 'Windows' ||
               file_exists('/proc/version') && strpos(file_get_contents('/proc/version'), 'Microsoft') !== false ||
               file_exists('/proc/sys/fs/binfmt_misc/WSLInterop');
    }

    /**
     * Check if this is a production environment
     */
    private static function isProduction(): bool
    {
        // Production servers typically don't have desktop environments
        return !file_exists('/usr/bin/gnome-session') &&
               !file_exists('/usr/bin/startx') &&
               !file_exists('/usr/bin/unity') &&
               file_exists('/etc/nginx') &&
               file_exists('/var/www');
    }

    /**
     * Check whether the root (/) filesystem has more than $minGb free space.
     * Mirrors gvar_common.sh::root_has_sufficient_free_space. The threshold can
     * be overridden via the DEV_ROOT_MIN_FREE_GB environment variable.
     */
    private static function rootHasSufficientFreeSpace(int $minGb = 50): bool
    {
        $envGb = getenv('DEV_ROOT_MIN_FREE_GB');
        if ($envGb !== false && is_numeric($envGb)) {
            $minGb = (int) $envGb;
        }
        $free = @disk_free_space('/');
        if ($free === false) {
            return false;
        }
        return $free > $minGb * (1024 ** 3);
    }

    /**
     * Detect system name + major version from /etc/os-release (distro ID /
     * VERSION_ID), e.g. ['kali','2026'], ['ubuntu','24']. Mirrors gvar_common.sh
     * SYSTEM_NAME/SYSTEM_VERSION and PathMapper::getSystemNameVersion. Falls back
     * to the kernel name only when /etc/os-release is unreadable.
     *
     * @return array{0:string,1:string} [name, majorVersion]
     */
    private static function getSystemNameVersion(): array
    {
        $name = '';
        $version = '';

        if (is_readable('/etc/os-release')) {
            $lines = @file('/etc/os-release', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                if ($name === '' && str_starts_with($line, 'ID=')) {
                    $name = strtolower(trim(substr($line, 3), " \t\"'"));
                } elseif ($version === '' && str_starts_with($line, 'VERSION_ID=')) {
                    $version = trim(substr($line, 11), " \t\"'");
                }
            }
        }

        if ($name === '') {
            $name = strtolower(php_uname('s'));
        }
        if ($version !== '' && str_contains($version, '.')) {
            $version = explode('.', $version)[0];
        }

        return [$name, $version];
    }

    /**
     * Map web path key to actual path (matches map_web_path() in gvar_common.sh)
     */
    public static function mapWebPath(string $pathKey, string $subPath = ''): string
    {
<<<<<<< HEAD
        // ALIGNED: delegate to the single canonical resolver (App\Providers\PathMapper)
        // so this helper can never diverge. It previously had its OWN base list
        // (/mnt/d, /mnt/data, /usr, /mnt/dev_sdb3) with an isProduction->/www short-circuit
        // that could emit /usr/www and disagree with the shell + Python. PathMapper now
        // owns the persisted-base + disk-detection logic shared across sh/py/php.
        return \App\Providers\PathMapper::mapWebPath($pathKey, $subPath);
=======
        $mappedPath = '';
        $basePath = '';

        // Get optimal base directory
        $dataBase = self::getBaseDataDirectory();

        // Determine base path for www based on environment
        if (self::isWsl()) {
            $basePath = $dataBase . '/www';
        } elseif (self::isProduction()) {
            $basePath = '/www';
        } else {
            // Use data base directory + www
            $basePath = $dataBase . '/www';
        }

        // Map paths using common base path (matches bash case statement)
        switch ($pathKey) {
            case 'wwwroot':
                $mappedPath = $basePath . '/wwwroot';
                break;
            case 'nginxconfig':
                $mappedPath = $basePath . '/nginxconfig';
                break;
            case 'shared-data':
                $mappedPath = $basePath . '/shared-data';
                break;
            case 'backup':
                $mappedPath = $basePath . '/backup';
                break;
            case 'www':
                $mappedPath = $basePath;
                break;
            case 'compile_dir':
                // Compile directory for development languages
                // Local /opt: root (/) has > DEV_ROOT_MIN_FREE_GB free (non-WSL)
                // Development (WSL/Desktop/NTFS): base_dir/_system_version (with underscore prefix)
                // Production server: /usr/system_version
                // Name from /etc/os-release (distro id + major version), e.g. kali / 2026,
                // matching gvar_common.sh SYSTEM_NAME/SYSTEM_VERSION (NOT the kernel).
                [$sysName, $sysVersion] = self::getSystemNameVersion();

                $optDir = "/opt/_{$sysName}_{$sysVersion}";
                if (!self::isWsl() && (is_dir($optDir) || self::rootHasSufficientFreeSpace())) {
                    // STICKY /opt: if it is already in use keep using it; otherwise
                    // select it when root (/) has ample space. Once /opt is chosen
                    // all later installs stay there even if root later shrinks.
                    $mappedPath = $optDir;
                } elseif (self::isWsl() || !self::isProduction()) {
                    // Development: base_dir/_system_version (with underscore prefix)
                    $mappedPath = $dataBase . "/_{$sysName}_{$sysVersion}";
                } else {
                    // Production: /usr/system_version
                    $mappedPath = "/usr/{$sysName}_{$sysVersion}";
                }
                break;
            default:
                // Default: treat as subdirectory under www
                $mappedPath = $basePath . '/' . $pathKey;
                break;
        }

        // Add subpath if provided
        if (!empty($subPath)) {
            $mappedPath = rtrim($mappedPath, '/') . '/' . ltrim($subPath, '/');
        }

        return $mappedPath;
>>>>>>> c8692e2ea856c43604b88627fa8fceaf39d53b55
    }

    /**
     * Get web root directory (for backward compatibility)
     */
    public static function getWwwRoot(): string
    {
        return self::mapWebPath('wwwroot');
    }

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
        return self::mapWebPath('nginxconfig') . '/ssl';
    }

    /**
     * Get sites-available directory
     */
    public static function getSitesAvailable(): string
    {
        return self::mapWebPath('nginxconfig') . '/sites-available';
    }

    /**
     * Get sites-enabled directory
     */
    public static function getSitesEnabled(): string
    {
        return self::mapWebPath('nginxconfig') . '/sites-enabled';
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
                'isWsl' => self::isWsl(),
                'isProduction' => self::isProduction(),
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
            ],
            'validation' => [
                'wwwroot' => self::validatePath(self::getWwwRoot()),
                'nginxconfig' => self::validatePath(self::getNginxConfig()),
                'ssl' => self::validatePath(self::getSSLDir()),
                'sites_available' => self::validatePath(self::getSitesAvailable()),
            ]
        ];
    }
}