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
        $tableName = GlobalTablesMap::getTableName('RELAY_NONCES');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'credential_scope' => ['type' => 'string', 'length' => 160],
                'nonce_hash' => ['type' => 'char', 'length' => 64],
                'expires_at' => ['type' => 'timestamp'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['credential_scope', 'nonce_hash'], 'name' => 'relay_nonces_scope_nonce_uq', 'unique' => true],
                ['columns' => ['expires_at'], 'name' => 'relay_nonces_expiry_idx'],
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
