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
        $isWsl = strpos($coreNodePath, '/mnt/d/') === 0 || strpos($coreNodePath, '/mnt/c/') === 0;
        $isProduction = strpos($coreNodePath, '/www/wwwroot/') === 0;
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
     * Resolve web directory path based on environment
     */
    public static function resolveWebRoot(): string
    {
        if (self::isWSL()) {
            return '/mnt/d/www/wwwroot';
        }

        return '/www/wwwroot';
    }

    /**
     * Get nginx paths based on environment
     */
    public static function getNginxPaths(): array
    {
        if (self::isWSL()) {
            return [
                'config_path' => '/etc/nginx/sites-available',
                'enabled_path' => '/etc/nginx/sites-enabled',
                'available' => file_exists('/etc/nginx/sites-available'),
                'note' => 'WSL environment - nginx may not be installed'
            ];
        }

        return [
            'config_path' => '/etc/nginx/sites-available',
            'enabled_path' => '/etc/nginx/sites-enabled',
            'available' => file_exists('/etc/nginx/sites-available'),
            'note' => 'Production environment'
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
