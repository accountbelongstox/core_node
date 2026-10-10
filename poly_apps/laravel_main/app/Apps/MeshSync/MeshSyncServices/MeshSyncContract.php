<?php

namespace App\Apps\MeshSync\MeshSyncServices;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

/** Reader of config/mesh_sync_contract.json, shared with pycore and the UI. */
final class MeshSyncContract
{
    private const FILE = '/config/mesh_sync_contract.json';

    private static ?array $document = null;

    public static function document(): array
    {
        self::$document ??= json_decode(
            FileSystemManager::readFile(PathMapper::getCoreNodeDir().self::FILE),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        return self::$document;
    }

    public static function get(string $key): mixed
    {
        return self::document()[$key];
    }

    public static function limit(string $key): int
    {
        return (int) self::document()['limits'][$key];
    }

    public static function auth(string $key): string
    {
        return (string) self::document()['auth'][$key];
    }

    /** @return array{method: string, path: string} */
    public static function route(string $name): array
    {
        return self::document()['routes'][$name];
    }

    /** Route path relative to the `/api/` prefix. */
    public static function routePrefix(): string
    {
        return ltrim(substr((string) self::get('api_prefix'), strlen('/api')), '/');
    }

    /** Absolute request path of one route below a server base path (e.g. `/laravel-api`). */
    public static function requestPath(string $basePath, string $name): string
    {
        return rtrim($basePath, '/').(string) self::get('api_prefix').'/'.self::route($name)['path'];
    }

    public static function validStream(string $stream): bool
    {
        return preg_match('~'.(string) self::get('stream_pattern').'~', $stream) === 1;
    }

    private function __construct()
    {
    }
}
