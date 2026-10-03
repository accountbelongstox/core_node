<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use App\Models\AppModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DailyReadingVirtualProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserBookReadingProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserDailyReadingReadModel;

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
        $results = [];

        $results += self::ensureBookProgressTable();
        $results += self::ensureDailyReadingVirtualProgressTable();
        $results += self::ensureDailyReadingReadsTable();

        return $results;
    }

    public static function ensureBookProgressTable(): array
    {
        return self::ensureTable(
            AppQyV1UserBookReadingProgressModel::class,
            [
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
            ]
        );
    }

    public static function ensureDailyReadingVirtualProgressTable(): array
    {
        return self::ensureTable(
            AppQyV1DailyReadingVirtualProgressModel::class,
            [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                    'batch_name' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                    'language_code' => ['type' => 'string', 'length' => 16, 'nullable' => false],
                    'words' => ['type' => 'json', 'nullable' => false],
                    'requests' => ['type' => 'json', 'nullable' => true],
                    'total_words' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                    // Last overlay or record of the batch: pruning removes the stalest first.
                    'last_used_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    [
                        'columns' => ['user_id', 'batch_name', 'language_code'],
                        'name' => 'unique_drvp_user_batch_lang',
                        'unique' => true,
                    ],
                    [
                        'columns' => ['user_id', 'updated_at'],
                        'name' => 'idx_drvp_user_updated',
                    ],
                    [
                        'columns' => ['user_id', 'last_used_at'],
                        'name' => 'idx_drvp_user_last_used',
                    ],
                ],
            ]
        );
    }

    public static function ensureDailyReadingReadsTable(): array
    {
        return self::ensureTable(
            AppQyV1UserDailyReadingReadModel::class,
            [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false],
                    'article_id' => ['type' => 'string', 'length' => 255, 'nullable' => false],
                    'read_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    [
                        'columns' => ['user_id', 'article_id'],
                        'name' => 'unique_udrr_user_article',
                        'unique' => true,
                    ],
                    [
                        'columns' => ['user_id', 'read_at'],
                        'name' => 'idx_udrr_user_read_at',
                    ],
                ],
            ]
        );
    }

    private static function ensureTable(string $modelClass, array $tableStructure): array
    {
        /** @var AppModel $model */
        $model = new $modelClass();
        $connection = $model->getConnectionName();
        $tableName = $model->getTable();
        $existedBefore = Schema::connection($connection)->hasTable($tableName);

        $modelClass::ensureTableAligned($tableStructure);

        return [$tableName => $existedBefore ? 'exists' : 'created'];
    }
}
