<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class RuntimeConfigurationStore
{
    private const STORE_DIRECTORY = '.core_node_secrets';

    public static function directory(): string
    {
        return PathMapper::mapWebPath('laravel_data_dir', self::STORE_DIRECTORY);
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $normalizedKey = self::normalizeKey($key);
        $path = '';
        $value = false;

        if ($normalizedKey === '') {
            return $default;
        }

        $path = self::path($normalizedKey);
        if (!FileSystemManager::isFile($path) || !FileSystemManager::isReadable($path)) {
            return $default;
        }

        $value = FileSystemManager::readFile($path);
        if ($value === false || trim($value) === '') {
            return $default;
        }

        return trim($value);
    }

    public static function put(string $key, string $value): bool
    {
        $normalizedKey = self::normalizeKey($key);
        $directory = '';
        $path = '';

        if ($normalizedKey === '' || $value === '') {
            return false;
        }

        $directory = self::directory();
        if (!FileSystemManager::ensureDirectoryExists($directory, 0700)) {
            return false;
        }

        $path = self::path($normalizedKey);

        return FileSystemManager::writePrivateFile($path, $value."\n");
    }

    private static function path(string $normalizedKey): string
    {
        return self::directory().DIRECTORY_SEPARATOR.$normalizedKey;
    }

    private static function normalizeKey(string $key): string
    {
        $normalizedKey = preg_replace('/[^A-Z0-9_]/', '', strtoupper($key));

        return is_string($normalizedKey) ? $normalizedKey : '';
    }

    private function __construct()
    {
    }
}
