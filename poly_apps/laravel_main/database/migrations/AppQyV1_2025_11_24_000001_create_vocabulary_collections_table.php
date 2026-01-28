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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_collections');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'collection_name' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => false,
                ],
                'lang_code' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => false,
                    'index' => true,
                ],
                'source_type' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => false,
                    'default' => 'system',
                    'comment' => 'system|user_upload',
                ],
                'owner_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => true,
                    'comment' => 'User ID for private collections',
                ],
                'is_public' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
                ],
                'description' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'total_words' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'meta_data' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Additional metadata like difficulty level, category',
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
                    'columns' => ['lang_code', 'is_public'],
                    'name' => 'idx_lang_public',
                ],
                [
                    'columns' => ['owner_id'],
                    'name' => 'idx_owner',
                ],
                [
                    'columns' => ['collection_name', 'lang_code', 'owner_id'],
                    'name' => 'unique_collection_per_user_lang',
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
