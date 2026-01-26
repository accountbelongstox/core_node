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
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_words');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'group_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Group ID from word_groups table',
                ],
                'word_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Word ID from vocabulary_words table',
                ],
                'language_code' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => true,
                    'comment' => 'Language code: en, ja, lo, vi',
                ],
                'added_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'useCurrent' => true,
                    'comment' => 'When word was added to group',
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
                    'columns' => ['group_id', 'word_id'],
                    'name' => 'unique_group_word',
                    'unique' => true,
                ],
                [
                    'columns' => ['group_id'],
                    'name' => 'idx_group_words_group',
                ],
                [
                    'columns' => ['word_id'],
                    'name' => 'idx_group_words_word',
                ],
                [
                    'columns' => ['language_code'],
                    'name' => 'idx_group_words_lang',
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
