<?php

namespace App\Apps\MeshSync\MeshSyncTablesMaps;

use App\Providers\GlobalTablesMap;
use App\Providers\TableMaps;

final class MeshSyncTablesMaps extends TableMaps
{
    public const RECORDS = [
        'tablename' => 'global_mesh_sync_records',
        'fields' => [],
    ];

    public const PEERS = [
        'tablename' => 'global_mesh_sync_peers',
        'fields' => [],
    ];

    protected static function getTablePrefix(): string
    {
        return '';
    }

    public static function getAvailableTableKeys(): array
    {
        return ['RECORDS', 'PEERS'];
    }

    public static function connection(): string
    {
        return GlobalTablesMap::getConnection();
    }
}
