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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_word_progress');
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
                    'comment' => 'User ID',
                ],
                'word_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Word ID from vocabulary_words',
                ],
                'group_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => true,
                    'comment' => 'Optional group ID',
                ],
                'language_code' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => true,
                    'comment' => 'Language code',
                ],
                'first_read_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'comment' => 'First time user read this word',
                ],
                'last_read_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'comment' => 'Last time user read this word',
                ],
                'last_review_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'comment' => 'Last review time',
                ],
                'next_review_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'comment' => 'Next scheduled review time',
                ],
                'read_count' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Number of times read',
                ],
                'review_count' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Number of times reviewed',
                ],
                'weight' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Weight (initially word length)',
                ],
                'proficiency' => [
                    'type' => 'decimal',
                    'precision' => 5,
                    'scale' => 2,
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Proficiency level 0-100',
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
                    'columns' => ['user_id', 'word_id', 'group_id'],
                    'name' => 'unique_user_word_group',
                    'unique' => true,
                ],
                [
                    'columns' => ['user_id', 'group_id'],
                    'name' => 'idx_progress_user_group',
                ],
                [
                    'columns' => ['user_id', 'next_review_at'],
                    'name' => 'idx_progress_next_review',
                ],
                [
                    'columns' => ['user_id', 'proficiency'],
                    'name' => 'idx_progress_proficiency',
                ],
                [
                    'columns' => ['word_id'],
                    'name' => 'idx_progress_word',
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
