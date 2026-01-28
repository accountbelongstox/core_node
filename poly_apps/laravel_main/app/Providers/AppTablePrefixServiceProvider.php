<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppTablePrefixServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }

    /**
     * Get app configuration
     *
     * @param string $appKey The app key (e.g., 'appqyv1', 'awyv0')
     * @return array The app configuration
     * @throws \InvalidArgumentException If app key is not found
     */
    public static function getAppConfig(string $appKey): array
    {
        $config = config("app_registry.{$appKey}");
        
        if (!$config) {
            throw new \InvalidArgumentException("App '{$appKey}' not found in registry. Available apps: " . implode(', ', array_keys(config('app_registry', []))));
        }
        
        return $config;
    }

    /**
     * Get table prefix for an app
     *
     * @param string $appKey The app key (e.g., 'appqyv1', 'awyv0')
     * @param string|null $version The version (e.g., 'v1'), defaults to current_version
     * @return string The table prefix (e.g., 'app_qy_v1', 'awy_v0')
     * @throws \InvalidArgumentException If app key is not found
     */
    public static function getPrefix(string $appKey, ?string $version = null): string
    {
        $config = self::getAppConfig($appKey);
        
        if ($version && isset($config['versions'][$version])) {
            return $config['versions'][$version];
        }
        
        return $config['table_prefix'];
    }

    /**
     * Get database connection name for an app
     *
     * @param string $appKey The app key (e.g., 'appqyv1', 'awyv0')
     * @return string The connection name (e.g., 'appqyv1', 'awyv0')
     * @throws \InvalidArgumentException If app key is not found
     */
    public static function getConnection(string $appKey): string
    {
        $config = self::getAppConfig($appKey);
        return $config['connection'];
    }

    /**
     * Build table name using app prefix and table suffix
     *
     * @param string $appKey The app key (e.g., 'appqyv1')
     * @param string $tableSuffix The table suffix (e.g., 'vocabulary_libraries')
     * @param string|null $version The version (e.g., 'v1'), defaults to current_version
     * @return string The full table name (e.g., 'app_qy_v1_vocabulary_libraries')
     */
    public static function buildTableName(string $appKey, string $tableSuffix, ?string $version = null): string
    {
        $prefix = self::getPrefix($appKey, $version);
        return "{$prefix}_{$tableSuffix}";
    }

    /**
     * Get table name for a specific app (magic method style)
     * Usage: AppTablePrefixServiceProvider::getAppQyV1TableName('vocabulary_libraries', 'v1')
     *
     * @param string $method Method name (e.g., 'getAppQyV1TableName')
     * @param array $args Arguments [tableSuffix, version?]
     * @return string The full table name
     * @throws \BadMethodCallException If method name is invalid
     */
    public static function __callStatic(string $method, array $args): string
    {
        // Parse method name: getAppQyV1TableName -> appqyv1
        if (preg_match('/^get([A-Z][a-zA-Z0-9]+)TableName$/', $method, $matches)) {
            $appName = strtolower($matches[1]);
            $appKey = self::normalizeAppKey($appName);
            
            $tableSuffix = $args[0] ?? null;
            $version = $args[1] ?? null;
            
            if (!$tableSuffix) {
                throw new \BadMethodCallException("Table suffix is required for {$method}");
            }
            
            return self::buildTableName($appKey, $tableSuffix, $version);
        }
        
        throw new \BadMethodCallException("Method {$method} does not exist");
    }

    /**
     * Normalize app name to app key
     * Examples:
     * - 'appqyv1' -> 'appqyv1'
     * - 'appqy' -> 'appqyv1' (if v1 is current)
     * - 'AppQyV1' -> 'appqyv1'
     *
     * @param string $appName
     * @return string
     */
    private static function normalizeAppKey(string $appName): string
    {
        $appNameLower = strtolower($appName);
        
        // Try direct match first
        if (config("app_registry.{$appNameLower}")) {
            return $appNameLower;
        }
        
        // Try matching by removing version suffix (v1, v0, etc.)
        $apps = config('app_registry', []);
        foreach ($apps as $key => $config) {
            // Remove version suffix from key for comparison
            $keyBase = preg_replace('/v\d+$/', '', $key);
            $nameBase = preg_replace('/v\d+$/', '', $appNameLower);
            
            if ($keyBase === $nameBase || $key === $appNameLower || strpos($key, $appNameLower) === 0) {
                return $key;
            }
        }
        
        throw new \InvalidArgumentException("App key not found for name: {$appName}. Available apps: " . implode(', ', array_keys($apps)));
    }

    /**
     * Get all registered app keys
     *
     * @return array
     */
    public static function getAppKeys(): array
    {
        return array_keys(config('app_registry', []));
    }

    /**
     * Check if an app key exists
     *
     * @param string $appKey
     * @return bool
     */
    public static function hasAppKey(string $appKey): bool
    {
        return config("app_registry.{$appKey}") !== null;
    }
}

