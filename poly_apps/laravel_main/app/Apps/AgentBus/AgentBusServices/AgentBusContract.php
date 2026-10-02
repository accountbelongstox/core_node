<?php

namespace App\Apps\AgentBus\AgentBusServices;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class AgentBusContract
{
    private const FILE = '/config/agent_bus_contract.json';

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

    public static function identity(string $key): string
    {
        return (string) self::document()['identity'][$key];
    }

    public static function realtime(string $key): string
    {
        return (string) self::document()['realtime'][$key];
    }

    /** @return array<int, array<string, mixed>> */
    public static function operations(): array
    {
        return self::document()['operations'];
    }

    public static function operation(string $name): ?array
    {
        foreach (self::operations() as $operation) {
            if ($operation['name'] === $name) {
                return $operation;
            }
        }

        return null;
    }

    /** Route path relative to the `/api/` prefix. */
    public static function routePrefix(): string
    {
        return ltrim(substr((string) self::get('api_prefix'), strlen('/api')), '/');
    }

    public static function mcpRoute(): string
    {
        return ltrim(substr((string) self::get('mcp_path'), strlen('/api')), '/');
    }

    private function __construct()
    {
    }
}
