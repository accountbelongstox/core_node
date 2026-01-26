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
            Schema::connection($this->connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $indexName = 'idx_cover_processing';
                $indexes = Schema::connection($this->connection)->getConnection()
                    ->select("SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?", [$indexName, $this->tableName]);
                if (!empty($indexes)) {
                    $table->dropIndex($indexName);
                }
                
                if (Schema::connection($this->connection)->hasColumn($this->tableName, 'attempts')) {
                    $table->dropColumn('attempts');
                }
            });
        }
    }
};
