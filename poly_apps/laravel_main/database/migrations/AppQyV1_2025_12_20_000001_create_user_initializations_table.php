<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection;
    protected $tableName;
    
    public function __construct()
    {
        $this->connection = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel)->getConnectionName();
        $this->tableName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel)->getTable();
    }

    public function up(): void
    {
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $prefix = \App\Providers\AppTablePrefixServiceProvider::getPrefix($appKey);
        
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'unique' => true,
                ],
                'occupation' => [
                    'type' => 'string',
                    'length' => 100,
                    'nullable' => true,
                ],
                'daily_words_target' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 20,
                ],
                'daily_study_time' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 30,
                ],
                'preferences' => [
                    'type' => 'text',
                    'nullable' => true,
                ],
                'is_initialized' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => false,
                ],
                'initialization_completed_at' => [
                    'type' => 'timestamp',
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
                    'columns' => ['user_id'],
                    'name' => 'idx_' . $prefix . '_user_init_user_id',
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
