<?php

namespace App\Apps\MeshSync\MeshSyncServices;

use App\Apps\MeshSync\MeshSyncTablesMaps\MeshSyncTablesMaps;
use App\Services\SafeMigrationHelper;
use Illuminate\Support\Facades\DB;

final class MeshSyncInitializer
{
    private const ALIGN_OPTIONS = ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true];
    private const ALIGNED_STATUSES = ['created', 'updated', 'aligned'];

    private static bool $ready = false;

    public static function structures(): array
    {
        return [
            'RECORDS' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'stream' => ['type' => 'string', 'length' => 64],
                    'record_key' => ['type' => 'string', 'length' => 255],
                    'origin' => ['type' => 'string', 'length' => 64],
                    'version' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'content_hash' => ['type' => 'string', 'length' => 64],
                    'deleted' => ['type' => 'boolean', 'default' => false],
                    'payload' => ['type' => 'json', 'nullable' => true],
                    'search_text' => ['type' => 'text', 'nullable' => true],
                    'seq' => ['type' => 'unsignedBigInteger'],
                    'received_from' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['stream', 'record_key'], 'name' => 'mesh_sync_records_key_uq', 'unique' => true],
                    ['columns' => ['seq'], 'name' => 'mesh_sync_records_seq_uq', 'unique' => true],
                    ['columns' => ['stream', 'version'], 'name' => 'mesh_sync_records_stream_version_idx'],
                ],
            ],
            'PEERS' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'base_url' => ['type' => 'string', 'length' => 512],
                    'server_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                    'source' => ['type' => 'string', 'length' => 16],
                    'cursor' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'cursor_server_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                    'failures' => ['type' => 'unsignedInteger', 'default' => 0],
                    'next_attempt_at' => ['type' => 'timestamp', 'nullable' => true],
                    'last_success_at' => ['type' => 'timestamp', 'nullable' => true],
                    'last_error' => ['type' => 'text', 'nullable' => true],
                    'seen_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['base_url'], 'name' => 'mesh_sync_peers_url_uq', 'unique' => true],
                    ['columns' => ['next_attempt_at'], 'name' => 'mesh_sync_peers_due_idx'],
                ],
            ],
        ];
    }

    public static function ensureTablesExist(): array
    {
        $connection = MeshSyncTablesMaps::connection();
        $results = [];
        $alignment = [];

        foreach (self::structures() as $key => $structure) {
            $alignment = SafeMigrationHelper::alignTableStructureFromArray(
                $connection, MeshSyncTablesMaps::getTableName($key), $structure, self::ALIGN_OPTIONS
            );
            if (!in_array($alignment['status'], self::ALIGNED_STATUSES, true)) {
                throw new \RuntimeException(__('mesh_sync.initialization_failed', ['resource' => $key]));
            }
            $results[$key] = $alignment['status'] === 'aligned' ? 'exists' : $alignment['status'];
        }

        return $results;
    }

    /** @return array<int, string> missing table names; an all-present result is cached per worker. */
    public static function missingTables(): array
    {
        $schema = null;
        $missing = [];
        $tableName = '';

        if (self::$ready) {
            return [];
        }
        $schema = DB::connection(MeshSyncTablesMaps::connection())->getSchemaBuilder();
        foreach (array_keys(self::structures()) as $key) {
            $tableName = MeshSyncTablesMaps::getTableName($key);
            if (!$schema->hasTable($tableName)) {
                $missing[] = $tableName;
            }
        }
        self::$ready = $missing === [];

        return $missing;
    }

    private function __construct()
    {
    }
}
