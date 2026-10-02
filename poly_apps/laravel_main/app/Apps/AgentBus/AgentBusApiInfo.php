<?php

namespace App\Apps\AgentBus;

use App\Apps\AgentBus\AgentBusServices\AgentBusContract;

final class AgentBusApiInfo
{
    public static function getApiInfo(): array
    {
        $prefix = (string) AgentBusContract::get('api_prefix');

        return [
            'app_name' => 'AgentBus',
            'api_version' => (string) AgentBusContract::get('schema_version'),
            'app_description' => __('agent_bus.api_description'),
            'api_prefix' => $prefix,
            'mcp_path' => AgentBusContract::get('mcp_path'),
            'mcp_transport' => 'streamable-http (stateless POST, JSON responses)',
            'authentication' => AgentBusContract::get('auth'),
            'identity' => AgentBusContract::get('identity'),
            'limits' => AgentBusContract::get('limits'),
            'realtime' => AgentBusContract::get('realtime'),
            'endpoints' => array_map(static fn (array $operation): array => [
                'tool' => $operation['name'],
                'method' => $operation['method'],
                'path' => $prefix.'/'.$operation['path'],
                'description' => $operation['description'],
                'params' => $operation['params'] ?? [],
            ], AgentBusContract::operations()),
        ];
    }
}
