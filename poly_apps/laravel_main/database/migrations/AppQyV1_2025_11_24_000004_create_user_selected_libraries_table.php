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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_selected_libraries');
    }

    public function up(): void
    {
        $collectionsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_collections');
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                ],
                'collection_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                ],
                'lang_code' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => false,
                ],
                'is_active' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
                ],
                'selected_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'useCurrent' => true,
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
                    'columns' => ['user_id', 'lang_code'],
                    'name' => 'idx_selected_lib_user_lang',
                ],
                [
                    'columns' => ['user_id', 'is_active'],
                    'name' => 'idx_selected_lib_user_active',
                ],
                [
                    'columns' => ['user_id', 'collection_id'],
                    'name' => 'unique_user_collection',
                    'unique' => true,
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
