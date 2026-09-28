<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Adds the nullable timestamp `shuffled_at` to group_word_progress - the
 * one-time-shuffle idempotency flag for the Default Vocabulary Group
 * (design doc §5.3). null = not yet shuffled; non-null = shuffled, do not
 * reshuffle. Mirrors the SafeMigrationHelper::alignTableStructureFromArray
 * pattern used by AppQyV1_2025_12_20_000005_add_language_fields_to_word_groups
 * (idempotent up/down, picked up by sys:init -> migrate --force).
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_word_progress');
    }

    public function up(): void
    {
        // This migration only adds the shuffled_at column to the existing
        // group_word_progress table (created by AppQyV1_2026_06_12_160000).
        $tableStructure = [
            'columns' => [
                'shuffled_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'after' => 'total_words',
                    'comment' => 'One-time-shuffle idempotency flag (Default Vocabulary Group); null = not yet shuffled',
                ],
            ],
            'indexes' => [],
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
        if (Schema::connection($this->connection)->hasTable($this->tableName)) {
            Schema::connection($this->connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->dropColumn(['shuffled_at']);
            });
        }
    }
};
