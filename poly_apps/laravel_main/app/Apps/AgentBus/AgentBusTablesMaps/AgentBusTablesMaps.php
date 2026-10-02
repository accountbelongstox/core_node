<?php

namespace App\Apps\AgentBus\AgentBusTablesMaps;

use App\Providers\GlobalTablesMap;
use App\Providers\TableMaps;

final class AgentBusTablesMaps extends TableMaps
{
    public const AGENTS = [
        'tablename' => 'global_agent_bus_agents',
        'fields' => [],
    ];

    public const MESSAGES = [
        'tablename' => 'global_agent_bus_messages',
        'fields' => [],
    ];

    public const TASKS = [
        'tablename' => 'global_agent_bus_tasks',
        'fields' => [],
    ];

    public const NOTES = [
        'tablename' => 'global_agent_bus_notes',
        'fields' => [],
    ];

    protected static function getTablePrefix(): string
    {
        return '';
    }

    public static function getAvailableTableKeys(): array
    {
        return ['AGENTS', 'MESSAGES', 'TASKS', 'NOTES'];
    }

    public static function connection(): string
    {
        return GlobalTablesMap::getConnection();
    }
}
