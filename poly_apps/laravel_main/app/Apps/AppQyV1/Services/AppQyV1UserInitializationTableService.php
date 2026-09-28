<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel;

class AppQyV1UserInitializationTableService
{
    /**
     * Idempotently ENSURE (create-if-missing) the AppQyV1 user-initialization
     * table. Uses the SAME SafeMigrationHelper structure as its migration, so
     * sys:init self-heals the table instead of printing a "run sys:init"
     * dead-end. Safe to run every init (aligns columns, never drops data).
     *
     * @return array<string,string> table => 'created' | 'exists'
     */
    public static function ensureTablesExist(): array
    {
        $model = new AppQyV1UserInitializationModel();
        $connection = $model->getConnectionName();
        $tableName = $model->getTable();

        $existedBefore = Schema::connection($connection)->hasTable($tableName);

        $appKey = AppKeys::APPQYV1;
        $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);

        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'unique' => true],
                'occupation' => ['type' => 'string', 'length' => 100, 'nullable' => true],
                'daily_words_target' => ['type' => 'integer', 'nullable' => false, 'default' => 20],
                'daily_study_time' => ['type' => 'integer', 'nullable' => false, 'default' => 30],
                'preferences' => ['type' => 'text', 'nullable' => true],
                'is_initialized' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'initialization_completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id'], 'name' => 'idx_' . $prefix . '_user_init_user_id'],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $connection,
            $tableName,
            $tableStructure,
            ['shrink_columns' => false, 'modify_columns' => true, 'add_indexes' => true]
        );

        return [$tableName => $existedBefore ? 'exists' : 'created'];
    }
}
