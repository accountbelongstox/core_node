<?php

use App\Providers\GlobalTablesMap;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $connection = GlobalTablesMap::getConnection();
        $tableName = GlobalTablesMap::getTableName('RELAY_OUTBOX');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'outbox_id' => ['type' => 'uuid'],
                'entity_type' => ['type' => 'string', 'length' => 64],
                'entity_id' => ['type' => 'string', 'length' => 128],
                'revision' => ['type' => 'unsignedInteger'],
                'event_type' => ['type' => 'string', 'length' => 128],
                'topic_role' => ['type' => 'string', 'length' => 32],
                'topic' => ['type' => 'text'],
                'private' => ['type' => 'boolean', 'default' => true],
                'payload' => ['type' => 'text'],
                'state' => ['type' => 'string', 'length' => 32, 'default' => 'pending'],
                'publish_attempts' => ['type' => 'unsignedInteger', 'default' => 0],
                'next_attempt_at' => ['type' => 'timestamp', 'nullable' => true],
                'published_at' => ['type' => 'timestamp', 'nullable' => true],
                'hub_update_id' => ['type' => 'string', 'length' => 255, 'nullable' => true],
                'last_publish_error' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['outbox_id'], 'name' => 'relay_outbox_id_uq', 'unique' => true],
                ['columns' => ['entity_type', 'entity_id', 'revision', 'event_type'], 'name' => 'relay_outbox_transition_uq', 'unique' => true],
                ['columns' => ['state', 'next_attempt_at', 'id'], 'name' => 'relay_outbox_publish_idx'],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray($connection, $tableName, $tableStructure, [
            'shrink_columns' => false,
            'modify_columns' => true,
            'add_indexes' => true,
        ]);
    }

    public function down(): void
    {
    }
};
