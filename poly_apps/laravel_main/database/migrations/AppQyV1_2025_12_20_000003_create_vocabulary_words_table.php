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
        $this->connection = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyWordModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_words');
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
                ],
                'word_index' => [
                    'type' => 'integer',
                    'nullable' => false,
                ],
                'word' => [
                    'type' => 'text',
                    'nullable' => false,
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['library_id'],
                    'name' => 'idx_vocab_words_library',
                ],
                [
                    'columns' => ['word'],
                    'name' => 'idx_vocab_words_word',
                ],
                [
                    'columns' => ['library_id', 'word_index'],
                    'name' => 'idx_vocab_words_lib_index',
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
