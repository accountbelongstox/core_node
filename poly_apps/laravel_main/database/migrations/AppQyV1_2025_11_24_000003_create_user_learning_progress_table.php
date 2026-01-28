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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_learning_progress');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                ],
                'lang_code' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => false,
                ],
                'word_md5' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                ],
                'word_content' => [
                    'type' => 'text',
                    'nullable' => false,
                ],
                'learning_status' => [
                    'type' => 'string',
                    'length' => 20,
                    'nullable' => false,
                    'default' => 'new',
                    'comment' => 'new|learning|learned|reviewing|mastered',
                ],
                'review_count' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'correct_count' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'wrong_count' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'last_reviewed_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'next_review_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'comment' => 'Spaced repetition schedule',
                ],
                'familiarity_level' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => '0-5 based on spaced repetition algorithm',
                ],
                'review_history' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Track review performance over time',
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'deleted_at' => [
                    'type' => 'softDeletes',
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['user_id', 'lang_code'],
                    'name' => 'idx_learning_progress_user_lang',
                ],
                [
                    'columns' => ['user_id', 'learning_status'],
                    'name' => 'idx_user_status',
                ],
                [
                    'columns' => ['user_id', 'next_review_at'],
                    'name' => 'idx_user_next_review',
                ],
                [
                    'columns' => ['word_md5'],
                    'name' => 'idx_word_md5',
                ],
                [
                    'columns' => ['user_id', 'lang_code', 'word_md5'],
                    'name' => 'unique_user_word',
                    'unique' => true,
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
