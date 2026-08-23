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
        $tableName = GlobalTablesMap::getTableName('RELAY_BLOBS');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'blob_id' => ['type' => 'uuid'],
                'owner_user_id' => ['type' => 'unsignedBigInteger'],
                'device_id' => ['type' => 'uuid'],
                'pairing_id' => ['type' => 'uuid'],
                'operation_id' => ['type' => 'uuid', 'nullable' => true],
                'direction' => ['type' => 'string', 'length' => 16],
                'operation_revision' => ['type' => 'unsignedInteger', 'nullable' => true],
                'claim_epoch' => ['type' => 'unsignedInteger', 'nullable' => true],
                'lease_owner' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'expected_sha256' => ['type' => 'char', 'length' => 64],
                'expected_length' => ['type' => 'bigInteger'],
                'final_sha256' => ['type' => 'char', 'length' => 64, 'nullable' => true],
                'final_length' => ['type' => 'bigInteger', 'nullable' => true],
                'received_chunk_count' => ['type' => 'unsignedInteger', 'default' => 0],
                'received_length' => ['type' => 'bigInteger', 'default' => 0],
                'finalized_at' => ['type' => 'timestamp', 'nullable' => true],
                'expires_at' => ['type' => 'timestamp'],
                'revision' => ['type' => 'unsignedInteger', 'default' => 1],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['blob_id'], 'name' => 'relay_blobs_id_uq', 'unique' => true],
                ['columns' => ['operation_id', 'direction', 'claim_epoch'], 'name' => 'relay_blobs_operation_direction_uq', 'unique' => true],
                ['columns' => ['owner_user_id', 'finalized_at', 'expires_at'], 'name' => 'relay_blobs_owner_quota_idx'],
                ['columns' => ['device_id', 'direction', 'expires_at'], 'name' => 'relay_blobs_device_direction_idx'],
                ['columns' => ['operation_id', 'claim_epoch'], 'name' => 'relay_blobs_operation_epoch_idx'],
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
