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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_languages');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'user_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => false,
                ],
                'language' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => false,
                ],
                'native_language' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => true,
                ],
                'is_learning' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
                ],
                'proficiency_level' => [
                    'type' => 'string',
                    'length' => 50,
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
                    'columns' => ['user_id', 'language'],
                    'name' => 'uniq_user_language',
                    'unique' => true,
                ],
                [
                    'columns' => ['user_id'],
                    'name' => 'idx_user_lang_user',
                ],
                [
                    'columns' => ['is_learning'],
                    'name' => 'idx_user_lang_learning',
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
