<?php

namespace App\Apps\AgentBus\AgentBusServices;

use App\Apps\AgentBus\AgentBusTablesMaps\AgentBusTablesMaps;
use App\Services\SafeMigrationHelper;
use Illuminate\Support\Facades\DB;

final class AgentBusInitializer
{
    private const ALIGN_OPTIONS = ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true];
    private const ALIGNED_STATUSES = ['created', 'updated', 'aligned'];

    private static bool $ready = false;

    public static function structures(): array
    {
        return [
            'AGENTS' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'agent_id' => ['type' => 'string', 'length' => 129],
                    'machine' => ['type' => 'string', 'length' => 64],
                    'name' => ['type' => 'string', 'length' => 64],
                    'client' => ['type' => 'string', 'length' => 32, 'nullable' => true],
                    'roles' => ['type' => 'json', 'nullable' => true],
                    'channels' => ['type' => 'json', 'nullable' => true],
                    'capabilities' => ['type' => 'json', 'nullable' => true],
                    'status' => ['type' => 'string', 'length' => 16, 'default' => 'idle'],
                    'summary' => ['type' => 'text', 'nullable' => true],
                    'inbox_cursor' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'last_seen_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['agent_id'], 'name' => 'agent_bus_agents_agent_id_uq', 'unique' => true],
                    ['columns' => ['last_seen_at'], 'name' => 'agent_bus_agents_last_seen_idx'],
                ],
            ],
            'MESSAGES' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'from_agent' => ['type' => 'string', 'length' => 129],
                    'to_kind' => ['type' => 'string', 'length' => 16],
                    'to_target' => ['type' => 'string', 'length' => 129],
                    'kind' => ['type' => 'string', 'length' => 16],
                    'subject' => ['type' => 'string', 'length' => 200],
                    'body' => ['type' => 'text'],
                    'refs' => ['type' => 'json', 'nullable' => true],
                    'reply_to' => ['type' => 'unsignedBigInteger', 'nullable' => true],
                    'task_id' => ['type' => 'unsignedBigInteger', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['to_kind', 'to_target', 'id'], 'name' => 'agent_bus_messages_target_idx'],
                    ['columns' => ['from_agent', 'id'], 'name' => 'agent_bus_messages_from_idx'],
                    ['columns' => ['task_id'], 'name' => 'agent_bus_messages_task_idx'],
                ],
            ],
            'TASKS' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'title' => ['type' => 'string', 'length' => 200],
                    'body' => ['type' => 'text'],
                    'requester' => ['type' => 'string', 'length' => 129],
                    'target_kind' => ['type' => 'string', 'length' => 16],
                    'target' => ['type' => 'string', 'length' => 129],
                    'status' => ['type' => 'string', 'length' => 16],
                    'assignee' => ['type' => 'string', 'length' => 129, 'nullable' => true],
                    'lease_until' => ['type' => 'timestamp', 'nullable' => true],
                    'priority' => ['type' => 'integer', 'default' => 0],
                    'progress' => ['type' => 'text', 'nullable' => true],
                    'result' => ['type' => 'text', 'nullable' => true],
                    'refs' => ['type' => 'json', 'nullable' => true],
                    'result_refs' => ['type' => 'json', 'nullable' => true],
                    'revision' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status', 'id'], 'name' => 'agent_bus_tasks_status_idx'],
                    ['columns' => ['assignee', 'id'], 'name' => 'agent_bus_tasks_assignee_idx'],
                    ['columns' => ['target_kind', 'target', 'id'], 'name' => 'agent_bus_tasks_target_idx'],
                ],
            ],
            'NOTES' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'note_key' => ['type' => 'string', 'length' => 200],
                    'title' => ['type' => 'string', 'length' => 200, 'nullable' => true],
                    'body' => ['type' => 'text'],
                    'tags' => ['type' => 'json', 'nullable' => true],
                    'refs' => ['type' => 'json', 'nullable' => true],
                    'author' => ['type' => 'string', 'length' => 129],
                    'revision' => ['type' => 'unsignedBigInteger', 'default' => 1],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['note_key'], 'name' => 'agent_bus_notes_key_uq', 'unique' => true],
                ],
            ],
        ];
    }

    public static function ensureTablesExist(): array
    {
        $connection = AgentBusTablesMaps::connection();
        $results = [];
        $alignment = [];

        foreach (self::structures() as $key => $structure) {
            $alignment = SafeMigrationHelper::alignTableStructureFromArray(
                $connection, AgentBusTablesMaps::getTableName($key), $structure, self::ALIGN_OPTIONS
            );
            if (!in_array($alignment['status'], self::ALIGNED_STATUSES, true)) {
                throw new \RuntimeException(__('agent_bus.initialization_failed', ['resource' => $key]));
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
        $schema = DB::connection(AgentBusTablesMaps::connection())->getSchemaBuilder();
        foreach (array_keys(self::structures()) as $key) {
            $tableName = AgentBusTablesMaps::getTableName($key);
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
