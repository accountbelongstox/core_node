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
        $tableName = GlobalTablesMap::getTableName('RELAY_DEVICES');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'device_id' => ['type' => 'uuid'],
                'owner_user_id' => ['type' => 'unsignedBigInteger', 'nullable' => true],
                'label' => ['type' => 'string', 'length' => 255],
                'platform' => ['type' => 'text', 'nullable' => true],
                'capabilities' => ['type' => 'json', 'nullable' => true],
                'capability_digest' => ['type' => 'char', 'length' => 64],
                'contract_digest' => ['type' => 'char', 'length' => 64],
                'status' => ['type' => 'string', 'length' => 32, 'default' => 'active'],
                'current_credential_version' => ['type' => 'unsignedInteger', 'default' => 0],
                'last_seen_at' => ['type' => 'timestamp', 'nullable' => true],
                'credential_expires_at' => ['type' => 'timestamp', 'nullable' => true],
                'revoked_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['device_id'], 'name' => 'relay_devices_device_uq', 'unique' => true],
                ['columns' => ['owner_user_id', 'status'], 'name' => 'relay_devices_owner_status_idx'],
                ['columns' => ['last_seen_at'], 'name' => 'relay_devices_seen_idx'],
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
