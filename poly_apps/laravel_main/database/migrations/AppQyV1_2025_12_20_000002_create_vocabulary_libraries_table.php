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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'name' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => false,
                ],
                'description' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'language' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => false,
                    'default' => 'english',
                ],
                'total_words' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'is_public' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
                ],
                'owner_user_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => true,
                ],
                'source' => [
                    // Canonical NOT-NULL idempotency key (name+language derived
                    // when not explicitly given). NOT NULL + the unique index
                    // below make a duplicate library row impossible. On existing
                    // installs the NOT-NULL flip + backfill is done by
                    // AppQyV1_2026_06_20_200002 (after the 200001 dedup).
                    'type' => 'string',
                    'length' => 100,
                    'nullable' => false,
                ],
                'difficulty_level' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => true,
                ],
                'category' => [
                    'type' => 'string',
                    'length' => 100,
                    'nullable' => false,
                    'default' => 'general',
                ],
                'image_url' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'is_recommended' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => false,
                ],
                'tags' => [
                    'type' => 'text',
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
                    'columns' => ['source'],
                    'name' => 'uniq_vocab_lib_source',
                    'unique' => true,
                ],
                [
                    'columns' => ['language'],
                    'name' => 'idx_vocab_lib_language',
                ],
                [
                    'columns' => ['is_public'],
                    'name' => 'idx_vocab_lib_public',
                ],
                [
                    'columns' => ['owner_user_id'],
                    'name' => 'idx_vocab_lib_owner',
                ],
                [
                    'columns' => ['category'],
                    'name' => 'idx_vocab_lib_category',
                ],
                [
                    'columns' => ['is_recommended'],
                    'name' => 'idx_vocab_lib_recommended',
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
