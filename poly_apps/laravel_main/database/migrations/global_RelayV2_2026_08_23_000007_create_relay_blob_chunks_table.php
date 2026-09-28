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
        $tableName = GlobalTablesMap::getTableName('RELAY_BLOB_CHUNKS');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'blob_id' => ['type' => 'uuid'],
                'chunk_index' => ['type' => 'unsignedInteger'],
                'chunk_sha256' => ['type' => 'char', 'length' => 64],
                'chunk_length' => ['type' => 'unsignedInteger'],
                'storage_relative_path' => ['type' => 'string', 'length' => 255],
                'stored_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['blob_id', 'chunk_index'], 'name' => 'relay_blob_chunks_index_uq', 'unique' => true],
                ['columns' => ['blob_id', 'chunk_sha256'], 'name' => 'relay_blob_chunks_digest_idx'],
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
