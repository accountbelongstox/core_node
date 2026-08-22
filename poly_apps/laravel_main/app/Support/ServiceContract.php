<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use RuntimeException;

/**
 * Laravel adapter for the canonical service contract (ports, loopback host,
 * shared external data paths, shared file names).
 *
 * Source: config/service_contract.json (repo root)
 * Aligned adapters:
 * - scripts/shells/linux/common/service_contract_common.sh
 * - poly_apps/pycore_laravel_wordnew_ui/core/contracts/ServiceContract.ts
 *
 * A port, host, shared path or shared file name must be changed in the JSON
 * source first; every end reads the same file. Mirrors the path resolution
 * of QueueCenterContract (config/ at the repo root).
 */
final class ServiceContract
{
    private static ?array $document = null;

    public static function document(): array
    {
        if (self::$document !== null) {
            return self::$document;
        }

        $path = PathMapper::getCoreNodeDir().DIRECTORY_SEPARATOR.'config'
            .DIRECTORY_SEPARATOR.'service_contract.json';
        $json = FileSystemManager::readFile($path, false);
        $document = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($document)) {
            throw new RuntimeException("Unable to load service contract: {$path}");
        }

        self::$document = $document;

        return self::$document;
    }

    public static function port(string $name): int
    {
        $ports = self::document()['ports'] ?? [];
        if (!isset($ports[$name]) || !is_int($ports[$name])) {
            throw new RuntimeException("Unknown service contract port: {$name}");
        }

        return $ports[$name];
    }

    public static function host(string $name): string
    {
        $hosts = self::document()['hosts'] ?? [];
        if (!isset($hosts[$name]) || !is_string($hosts[$name])) {
            throw new RuntimeException("Unknown service contract host: {$name}");
        }

        return $hosts[$name];
    }

    public static function file(string $name): string
    {
        $files = self::document()['files'] ?? [];
        if (!isset($files[$name]) || !is_string($files[$name])) {
            throw new RuntimeException("Unknown service contract file: {$name}");
        }

        return $files[$name];
    }

    public static function path(string $name): string
    {
        $paths = self::document()['paths'] ?? [];
        if (!isset($paths[$name]) || !is_string($paths[$name]) || $paths[$name] === '') {
            throw new RuntimeException("Unknown service contract path: {$name}");
        }

        return $paths[$name];
    }

    public static function string(string $path): string
    {
        $value = self::document();
        foreach (explode('.', $path) as $segment) {
            $value = is_array($value) && array_key_exists($segment, $value)
                ? $value[$segment]
                : null;
        }
        if (!is_string($value) || $value === '') {
            throw new RuntimeException("Unknown service contract string: {$path}");
        }

        return $value;
    }

    public static function positiveInt(string $path): int
    {
        $value = self::document();
        foreach (explode('.', $path) as $segment) {
            $value = is_array($value) && array_key_exists($segment, $value)
                ? $value[$segment]
                : null;
        }
        if (!is_int($value) || $value < 1) {
            throw new RuntimeException("Unknown service contract positive integer: {$path}");
        }

        return $value;
    }

    public static function boolean(string $path): bool
    {
        $value = self::document();
        foreach (explode('.', $path) as $segment) {
            $value = is_array($value) && array_key_exists($segment, $value)
                ? $value[$segment]
                : null;
        }
        if (!is_bool($value)) {
            throw new RuntimeException("Unknown service contract boolean: {$path}");
        }

        return $value;
    }

    /**
     * @return array<int, string>
     */
    public static function stringList(string $path): array
    {
        $value = self::document();
        foreach (explode('.', $path) as $segment) {
            $value = is_array($value) && array_key_exists($segment, $value)
                ? $value[$segment]
                : null;
        }
        if (!is_array($value)
            || $value === []
            || array_filter($value, static fn (mixed $item): bool => !is_string($item) || $item === '') !== []) {
            throw new RuntimeException("Unknown service contract string list: {$path}");
        }

        return array_values($value);
    }

    public static function laravelApiBackendUrl(): string
    {
        return 'http://'.self::host('loopback').':'.self::port('laravel_api_backend');
    }

    private function __construct()
    {
    }
}
