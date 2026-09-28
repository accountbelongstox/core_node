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
        $tableName = GlobalTablesMap::getTableName('RELAY_ENROLLMENTS');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'enrollment_id' => ['type' => 'uuid'],
                'device_id' => ['type' => 'uuid'],
                'public_key' => ['type' => 'string', 'length' => 128],
                'key_algorithm' => ['type' => 'string', 'length' => 32],
                'key_version' => ['type' => 'unsignedInteger'],
                'label' => ['type' => 'string', 'length' => 255],
                'platform' => ['type' => 'text', 'nullable' => true],
                'capabilities' => ['type' => 'json', 'nullable' => true],
                'capability_digest' => ['type' => 'char', 'length' => 64],
                'contract_digest' => ['type' => 'char', 'length' => 64],
                'claim_code_hash' => ['type' => 'char', 'length' => 64],
                'claim_code_encrypted' => ['type' => 'text'],
                'state' => ['type' => 'string', 'length' => 32, 'default' => 'pending'],
                'claimant_user_id' => ['type' => 'unsignedBigInteger', 'nullable' => true],
                'credential_id' => ['type' => 'uuid', 'nullable' => true],
                'claim_attempts' => ['type' => 'unsignedInteger', 'default' => 0],
                'expires_at' => ['type' => 'timestamp'],
                'claimed_at' => ['type' => 'timestamp', 'nullable' => true],
                'revoked_at' => ['type' => 'timestamp', 'nullable' => true],
                'revision' => ['type' => 'unsignedInteger', 'default' => 1],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['enrollment_id'], 'name' => 'relay_enrollments_id_uq', 'unique' => true],
                ['columns' => ['claim_code_hash'], 'name' => 'relay_enrollments_code_uq', 'unique' => true],
                ['columns' => ['device_id', 'public_key'], 'name' => 'relay_enrollments_device_key_uq', 'unique' => true],
                ['columns' => ['state', 'expires_at'], 'name' => 'relay_enrollments_state_expiry_idx'],
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
