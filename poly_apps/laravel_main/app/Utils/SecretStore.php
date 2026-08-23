<?php

namespace App\Utils;

use App\Providers\PathMapper;

final class SecretStore
{
    private const int DEFAULT_MAX_INDEX = 10;
    private const string SECRET_DIRECTORY = '.secret_keys/.secret_ignore';

    public static function get(string $keyName): string
    {
        $path = null;
        $content = false;

        $path = self::path($keyName);
        if ($path === null || !FileSystemManager::isFile($path)) {
            return '';
        }

        $content = FileSystemManager::readFile($path, false);

        return is_string($content) ? trim($content) : '';
    }

    public static function getIndexed(string $baseName, int $maxIndex = self::DEFAULT_MAX_INDEX): string
    {
        $values = [];

        $values = self::getAllIndexed($baseName, $maxIndex);

        return $values[0] ?? '';
    }

    public static function getAllIndexed(string $baseName, int $maxIndex = self::DEFAULT_MAX_INDEX): array
    {
        $values = [];
        $value = '';
        $boundedMaxIndex = 0;

        if (!self::isValidKeyName($baseName)) {
            return $values;
        }

        $boundedMaxIndex = max(0, $maxIndex);
        for ($index = 1; $index <= $boundedMaxIndex; $index++) {
            $value = self::get($baseName . '_' . $index);
            if ($value !== '' && !in_array($value, $values, true)) {
                $values[] = $value;
            }
        }

        $value = self::get($baseName);
        if ($value !== '' && !in_array($value, $values, true)) {
            $values[] = $value;
        }

        return $values;
    }

    public static function has(string $keyName): bool
    {
        return self::get($keyName) !== '';
    }

    public static function maskForDisplay(?string $value): ?string
    {
        $secret = trim((string) $value);

        if ($secret === '') {
            return null;
        }
        if (strlen($secret) <= 8) {
            return '…';
        }

        return substr($secret, 0, 4) . '…' . substr($secret, -4);
    }

    private static function path(string $keyName): ?string
    {
        $coreNodeDirectory = null;
        $secretDirectory = '';

        if (!self::isValidKeyName($keyName)) {
            return null;
        }

        $coreNodeDirectory = PathMapper::getCoreNodeDir();
        if (!is_string($coreNodeDirectory) || $coreNodeDirectory === '') {
            return null;
        }

        $secretDirectory = str_replace('/', DIRECTORY_SEPARATOR, self::SECRET_DIRECTORY);

        return $coreNodeDirectory . DIRECTORY_SEPARATOR . $secretDirectory . DIRECTORY_SEPARATOR . $keyName;
    }

    private static function isValidKeyName(string $keyName): bool
    {
        return preg_match('/\A[A-Z][A-Z0-9_]*\z/D', $keyName) === 1;
    }
}
