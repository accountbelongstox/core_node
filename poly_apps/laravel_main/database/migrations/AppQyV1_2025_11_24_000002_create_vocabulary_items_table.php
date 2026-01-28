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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_items');
    }

    public function up(): void
    {
        $collectionsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_collections');
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'collection_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                ],
                'lang_code' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => false,
                    'index' => true,
                ],
                'word_content' => [
                    'type' => 'text',
                    'nullable' => false,
                ],
                'word_md5' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'index' => true,
                ],
                'word_index' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Order in collection',
                ],
                'extra_data' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Additional word metadata',
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
                    'columns' => ['collection_id', 'word_index'],
                    'name' => 'idx_collection_index',
                ],
                [
                    'columns' => ['lang_code', 'word_md5'],
                    'name' => 'idx_lang_md5',
                ],
            ],
            'foreignKeys' => [
                [
                    'column' => 'collection_id',
                    'references' => $collectionsTableName,
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
