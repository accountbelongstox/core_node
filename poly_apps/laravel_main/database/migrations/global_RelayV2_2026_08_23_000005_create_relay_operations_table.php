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
        $tableName = GlobalTablesMap::getTableName('RELAY_OPERATIONS');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'operation_id' => ['type' => 'uuid'],
                'idempotency_key' => ['type' => 'string', 'length' => 128],
                'user_id' => ['type' => 'unsignedBigInteger'],
                'device_id' => ['type' => 'uuid'],
                'pairing_id' => ['type' => 'uuid'],
                'route_policy_key' => ['type' => 'string', 'length' => 255],
                'permission' => ['type' => 'string', 'length' => 128],
                'retry_policy' => ['type' => 'string', 'length' => 32],
                'method' => ['type' => 'string', 'length' => 16],
                'normalized_path' => ['type' => 'text'],
                'normalized_query' => ['type' => 'json'],
                'filtered_headers' => ['type' => 'json'],
                'request_digest' => ['type' => 'char', 'length' => 64],
                'request_body_present' => ['type' => 'boolean', 'default' => false],
                'request_body_base64' => ['type' => 'longText', 'nullable' => true],
                'request_blob_id' => ['type' => 'uuid', 'nullable' => true],
                'request_body_sha256' => ['type' => 'char', 'length' => 64],
                'request_body_length' => ['type' => 'bigInteger', 'default' => 0],
                'state' => ['type' => 'string', 'length' => 32, 'default' => 'accepted'],
                'revision' => ['type' => 'unsignedInteger', 'default' => 1],
                'attempt' => ['type' => 'unsignedInteger', 'default' => 0],
                'claim_epoch' => ['type' => 'unsignedInteger', 'default' => 0],
                'lease_owner' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'lease_expires_at' => ['type' => 'timestamp', 'nullable' => true],
                'response_status' => ['type' => 'integer', 'nullable' => true],
                'response_headers' => ['type' => 'json', 'nullable' => true],
                'response_body_present' => ['type' => 'boolean', 'nullable' => true],
                'response_body_base64' => ['type' => 'longText', 'nullable' => true],
                'response_blob_id' => ['type' => 'uuid', 'nullable' => true],
                'response_body_sha256' => ['type' => 'char', 'length' => 64, 'nullable' => true],
                'response_body_length' => ['type' => 'bigInteger', 'nullable' => true],
                'result_digest' => ['type' => 'char', 'length' => 64, 'nullable' => true],
                'error_code' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'accepted_at' => ['type' => 'timestamp'],
                'execution_started_at' => ['type' => 'timestamp', 'nullable' => true],
                'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'expires_at' => ['type' => 'timestamp'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['operation_id'], 'name' => 'relay_operations_id_uq', 'unique' => true],
                ['columns' => ['user_id', 'device_id', 'idempotency_key'], 'name' => 'relay_operations_idempotency_uq', 'unique' => true],
                ['columns' => ['device_id', 'state', 'lease_expires_at'], 'name' => 'relay_operations_claim_idx'],
                ['columns' => ['pairing_id', 'state', 'updated_at'], 'name' => 'relay_operations_pair_state_idx'],
                ['columns' => ['expires_at'], 'name' => 'relay_operations_expiry_idx'],
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
