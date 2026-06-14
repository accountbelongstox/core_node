<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
    }

    public function up(): void
    {
        $referencedTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'library_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => false,
                    'unique' => true,
                ],
                'cover_filename' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => false,
                ],
                'status' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => false,
                    'default' => 'pending',
                ],
                'prompt' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'description' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'priority' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                // Owned here (not only in AppQyV1_2025_12_01_..._add_cover_processing):
                // that migration sorts BEFORE this create-table one and skips when
                // the table does not exist, so fresh databases get the column here.
                'attempts' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'error_message' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'width' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 1280,
                ],
                'height' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 720,
                ],
                'last_requested_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'last_generated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'started_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'finished_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['status'],
                    'name' => 'idx_vocab_covers_status',
                ],
                [
                    'columns' => ['priority'],
                    'name' => 'idx_vocab_covers_priority',
                ],
                [
                    'columns' => ['status', 'priority', 'last_requested_at'],
                    'name' => 'idx_cover_processing',
                ],
            ],
            'foreignKeys' => [
                [
                    'column' => 'library_id',
                    'references' => $referencedTable,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
