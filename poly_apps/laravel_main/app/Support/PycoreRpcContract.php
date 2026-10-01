<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use RuntimeException;

/**
 * Laravel adapter for the pycore RPC route contract.
 *
 * Source: config/pycore_rpc_contract.json (repo root)
 * Aligned adapters:
 * - pycore/pyutils/common/rpc_route_contract.py
 * - poly_apps/pycore_laravel_wordnew_ui/core/integrations/pycore/PycoreHttpRoutes.ts
 *
 * `routes` are the handler routes, `protocol_routes` the server's own
 * descriptor routes (status/info/routes/client-id); both sit below `api_prefix`.
 */
final class PycoreRpcContract
{
    private const ROUTES = 'routes';
    private const PROTOCOL_ROUTES = 'protocol_routes';

    private static ?array $document = null;

    public static function document(): array
    {
        if (self::$document !== null) {
            return self::$document;
        }

        $path = PathMapper::getCoreNodeDir().DIRECTORY_SEPARATOR.'config'
            .DIRECTORY_SEPARATOR.'pycore_rpc_contract.json';
        $json = FileSystemManager::readFile($path, false);
        $document = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($document) || !is_array($document[self::ROUTES] ?? null)) {
            throw new RuntimeException("Unable to load pycore RPC contract: {$path}");
        }

        self::$document = $document;

        return self::$document;
    }

    /**
     * @return array{path: string, method: string} request path (with the API prefix) and HTTP method
     */
    public static function route(string $key): array
    {
        return self::resolve(self::ROUTES, $key);
    }

    /**
     * @return array{path: string, method: string}
     */
    public static function protocolRoute(string $key): array
    {
        return self::resolve(self::PROTOCOL_ROUTES, $key);
    }

    private static function resolve(string $section, string $key): array
    {
        $route = self::document()[$section][$key] ?? null;
        if (!is_array($route) || !is_string($route['path'] ?? null) || !is_string($route['method'] ?? null)) {
            throw new RuntimeException("Unknown pycore RPC contract route: {$section}.{$key}");
        }

        return [
            'path' => rtrim((string) self::document()['api_prefix'], '/').'/'.ltrim($route['path'], '/'),
            'method' => strtoupper($route['method']),
        ];
    }

    private function __construct()
    {
    }
}
