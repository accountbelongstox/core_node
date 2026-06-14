<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
    }

    public function up(): void
    {
        // Ordering quirk: this file sorts BEFORE the create-table migration
        // (AppQyV1_2025_12_20_000006_create_vocabulary_covers_table). On a fresh
        // database (e.g. a new per-app PostgreSQL database) the table does not
        // exist yet at this point and alignTableStructureFromArray would create a
        // partial table with only `attempts`, then fail indexing `status`. Skip
        // here; the create-table migration owns the FULL structure including
        // `attempts` and idx_cover_processing.
        if (!Schema::connection($this->connection)->hasTable($this->tableName)) {
            return;
        }

        // This migration only adds columns and indexes to existing table
        $tableStructure = [
            'columns' => [
                'attempts' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'after' => 'priority',
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['status', 'priority', 'last_requested_at'],
                    'name' => 'idx_cover_processing',
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
        if (Schema::connection($this->connection)->hasTable($this->tableName)) {
            // Native, driver-agnostic index-existence check (sqlite + pgsql) via
            // hasIndex() -- no raw pg_indexes / sqlite_master lookups.
            $indexName = 'idx_cover_processing';
            $hasIndex = Schema::connection($this->connection)->hasIndex($this->tableName, $indexName);

            Schema::connection($this->connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) use ($indexName, $hasIndex) {
                if ($hasIndex) {
                    $table->dropIndex($indexName);
                }

                if (Schema::connection($this->connection)->hasColumn($this->tableName, 'attempts')) {
                    $table->dropColumn('attempts');
                }
            });
        }
    }
};
