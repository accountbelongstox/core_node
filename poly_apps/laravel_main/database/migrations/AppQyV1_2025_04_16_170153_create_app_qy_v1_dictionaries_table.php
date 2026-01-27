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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'dictionaries');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'content' => [
                    'type' => 'text',
                    'nullable' => false,
                ],
                'md5' => [
                    'type' => 'text',
                    'nullable' => false,
                ],
                'translation' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'isTranslation' => [
                    'type' => 'boolean',
                    'nullable' => true,
                    'default' => false,
                ],
                'translation_provider' => [
                    'type' => 'integer',
                    'nullable' => true,
                    'default' => 0,
                ],
                'lastModified' => [
                    'type' => 'dateTime',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
                'lastInsertTime' => [
                    'type' => 'dateTime',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
                'lastUpdateTime' => [
                    'type' => 'dateTime',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
                'lastQueryTime' => [
                    'type' => 'dateTime',
                    'nullable' => true,
                    'useCurrent' => true,
                ],
                'queryCount' => [
                    'type' => 'integer',
                    'nullable' => true,
                    'default' => 0,
                ],
                'usPhonetic' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'ukPhonetic' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'voice_files' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'image_files' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'isExistLocal' => [
                    'type' => 'boolean',
                    'nullable' => true,
                    'default' => false,
                ],
                'voice_files_provider' => [
                    'type' => 'integer',
                    'nullable' => true,
                    'default' => 0,
                ],
                'image_files_provider' => [
                    'type' => 'integer',
                    'nullable' => true,
                    'default' => 0,
                ],
                'hasOperations' => [
                    'type' => 'boolean',
                    'nullable' => true,
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
                'createdAt' => [
                    'type' => 'dateTime',
                    'nullable' => true,
                    'useCurrent' => true,
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
