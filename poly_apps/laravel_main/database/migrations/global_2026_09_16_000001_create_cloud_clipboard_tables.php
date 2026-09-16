<?php

use App\Providers\GlobalTablesMap;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $connection = GlobalTablesMap::getConnection();
        $options = ['shrink_columns' => false, 'modify_columns' => true, 'add_indexes' => true];
        $structures = [
            'CLOUD_CLIPBOARD_ROOMS' => [
                'columns' => [
                    'id' => ['type' => 'uuid'],
                    'namespace' => ['type' => 'string', 'length' => 40],
                    'password_hash' => ['type' => 'text', 'nullable' => true],
                    'topic_key' => ['type' => 'uuid'],
                    'current_entry_id' => ['type' => 'uuid'],
                    'revision' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['id'], 'name' => 'clipboard_rooms_id_uq', 'unique' => true],
                    ['columns' => ['namespace'], 'name' => 'clipboard_rooms_namespace_uq', 'unique' => true],
                ],
            ],
            'CLOUD_CLIPBOARD_ENTRIES' => [
                'columns' => [
                    'id' => ['type' => 'uuid'],
                    'room_id' => ['type' => 'uuid'],
                    'text' => ['type' => 'text'],
                    'files' => ['type' => 'json'],
                    'revision' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'editor_user_id' => ['type' => 'unsignedBigInteger', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['id'], 'name' => 'clipboard_entries_id_uq', 'unique' => true],
                    ['columns' => ['room_id', 'created_at'], 'name' => 'clipboard_entries_room_created_idx'],
                ],
            ],
        ];

        foreach ($structures as $key => $structure) {
            SafeMigrationHelper::alignTableStructureFromArray(
                $connection, GlobalTablesMap::getTableName($key), $structure, $options
            );
        }
    }

    public function down(): void
    {
    }
};
