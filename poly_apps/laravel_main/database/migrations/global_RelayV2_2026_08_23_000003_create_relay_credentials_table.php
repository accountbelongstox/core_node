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
        $tableName = GlobalTablesMap::getTableName('RELAY_CREDENTIALS');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'credential_id' => ['type' => 'uuid'],
                'device_id' => ['type' => 'uuid'],
                'credential_version' => ['type' => 'unsignedInteger'],
                'public_key' => ['type' => 'string', 'length' => 128],
                'status' => ['type' => 'string', 'length' => 32, 'default' => 'active'],
                'expires_at' => ['type' => 'timestamp'],
                'revoked_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['credential_id'], 'name' => 'relay_credentials_id_uq', 'unique' => true],
                ['columns' => ['device_id', 'credential_version'], 'name' => 'relay_credentials_device_version_uq', 'unique' => true],
                ['columns' => ['device_id', 'status'], 'name' => 'relay_credentials_device_status_idx'],
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
