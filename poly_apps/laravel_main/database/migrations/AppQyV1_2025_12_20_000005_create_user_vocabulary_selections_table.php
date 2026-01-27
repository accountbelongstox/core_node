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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_vocabulary_selections');
    }

    public function up(): void
    {
        $referencedTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'user_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => false,
                ],
                'library_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => false,
                ],
                'selected_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
                'is_active' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
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
                    'columns' => ['user_id', 'library_id'],
                    'name' => 'uniq_user_library_selection',
                    'unique' => true,
                ],
                [
                    'columns' => ['user_id'],
                    'name' => 'idx_user_vocab_sel_user',
                ],
                [
                    'columns' => ['is_active'],
                    'name' => 'idx_user_vocab_sel_active',
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
