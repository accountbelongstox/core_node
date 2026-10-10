<?php

namespace App\Apps\MeshSync;

use App\Apps\MeshSync\MeshSyncServices\MeshSyncContract;

final class MeshSyncApiInfo
{
    public static function getApiInfo(): array
    {
        $prefix = (string) MeshSyncContract::get('api_prefix');
        $routes = (array) MeshSyncContract::get('routes');

        return [
            'app_name' => 'MeshSync',
            'api_version' => (string) MeshSyncContract::get('schema_version'),
            'app_description' => __('mesh_sync.api_description'),
            'api_prefix' => $prefix,
            'authentication' => MeshSyncContract::get('auth'),
            'streams' => MeshSyncContract::get('streams'),
            'limits' => MeshSyncContract::get('limits'),
            'endpoints' => array_map(static fn (string $name, array $route): array => [
                'name' => $name,
                'method' => $route['method'],
                'path' => $prefix.'/'.$route['path'],
                'description' => __('mesh_sync.route_'.$name),
            ], array_keys($routes), array_values($routes)),
        ];
    }
}
