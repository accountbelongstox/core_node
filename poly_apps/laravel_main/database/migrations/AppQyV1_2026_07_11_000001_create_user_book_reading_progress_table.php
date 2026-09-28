<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Per-(user, book) reading position. One row per source_key so a user can
 * track progress across many books without bloating a single JSON blob.
 * Not reusing group_word_progress — that table is per-word SRS inside groups.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_book_reading_progress');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Owner user id',
                ],
                'source_key' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => false,
                    'comment' => 'Book source_key from app_qy_v1_books',
                ],
                'chapter_index' => [
                    'type' => 'integer',
                    'nullable' => true,
                    'comment' => 'Last chapter index (null = flat book)',
                ],
                'verse_seq' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Last verse seq within chapter/book',
                ],
                'grain' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => true,
                    'default' => 'sentence',
                    'comment' => 'Verse grain (sentence, verse, etc.)',
                ],
                'page' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 1,
                    'comment' => 'API page when verse was last read',
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
