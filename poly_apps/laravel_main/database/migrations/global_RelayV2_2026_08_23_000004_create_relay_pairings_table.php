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
        $tableName = GlobalTablesMap::getTableName('RELAY_PAIRINGS');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'pairing_id' => ['type' => 'uuid'],
                'user_id' => ['type' => 'unsignedBigInteger'],
                'device_id' => ['type' => 'uuid'],
                'client_instance_hash' => ['type' => 'char', 'length' => 64],
                'state' => ['type' => 'string', 'length' => 32, 'default' => 'active'],
                'credential_version' => ['type' => 'unsignedInteger'],
                'revision' => ['type' => 'unsignedInteger', 'default' => 1],
                'last_seen_at' => ['type' => 'timestamp'],
                'expires_at' => ['type' => 'timestamp'],
                'revoked_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['pairing_id'], 'name' => 'relay_pairings_id_uq', 'unique' => true],
                ['columns' => ['user_id', 'device_id', 'client_instance_hash'], 'name' => 'relay_pairings_client_uq', 'unique' => true],
                ['columns' => ['user_id', 'state', 'expires_at'], 'name' => 'relay_pairings_owner_state_idx'],
                ['columns' => ['device_id', 'state', 'expires_at'], 'name' => 'relay_pairings_device_state_idx'],
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
