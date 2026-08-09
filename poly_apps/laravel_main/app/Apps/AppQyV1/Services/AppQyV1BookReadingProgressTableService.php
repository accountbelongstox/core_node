<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserBookReadingProgressModel;

class AppQyV1BookReadingProgressTableService
{
    /**
     * Idempotently ensure the per-(user, book) reading-progress table exists.
     * Mirrors AppQyV1UserInitializationTableService so sys:init self-heals even
     * when the dated migration was skipped on an older deployment.
     *
     * @return array<string,string> table => 'created' | 'exists'
     */
    public static function ensureTablesExist(): array
    {
        $model = new AppQyV1UserBookReadingProgressModel();
        $connection = $model->getConnectionName();
        $tableName = $model->getTable();

        $existedBefore = Schema::connection($connection)->hasTable($tableName);

        $appKey = AppKeys::APPQYV1;
        $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);

        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                'source_key' => ['type' => 'string', 'length' => 255, 'nullable' => false],
                'chapter_index' => ['type' => 'integer', 'nullable' => true],
                'verse_seq' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'grain' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'default' => 'sentence'],
                'page' => ['type' => 'integer', 'nullable' => false, 'default' => 1],
                'article_id' => ['type' => 'string', 'length' => 255, 'nullable' => true],
                'selection_mode' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'default' => 'latest'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                [
                    'columns' => ['user_id', 'source_key'],
                    'name' => 'unique_ubrp_user_source',
                    'unique' => true,
                ],
                [
                    'columns' => ['user_id'],
                    'name' => 'idx_ubrp_user',
                ],
                [
                    'columns' => ['updated_at'],
                    'name' => 'idx_ubrp_updated',
                ],
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
