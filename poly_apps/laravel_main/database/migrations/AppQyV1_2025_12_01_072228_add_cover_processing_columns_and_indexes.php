<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
        
        // Check if table exists before modifying it
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            return; // Table doesn't exist yet, skip this migration (will be created by create_vocabulary_covers_table migration)
        }
        
        Schema::connection($this->connection)->table($tableName, function (Blueprint $table) use ($tableName) {
            // Add attempts column for retry tracking (only if it doesn't exist)
            if (!Schema::connection($this->connection)->hasColumn($tableName, 'attempts')) {
                $table->integer('attempts')->default(0)->after('priority');
            }

            // Add composite index for efficient timer task queries
            // Optimizes: WHERE status IN ('pending', 'retry') ORDER BY priority DESC, last_requested_at ASC
            // Check if index already exists before adding
            $indexName = 'idx_cover_processing';
            $indexes = Schema::connection($this->connection)->getConnection()
                ->select("SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?", [$indexName, $tableName]);
            if (empty($indexes)) {
                $table->index(['status', 'priority', 'last_requested_at'], $indexName);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
        
        // Check if table exists before modifying it
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            return; // Table doesn't exist, nothing to rollback
        }
        
        Schema::connection($this->connection)->table($tableName, function (Blueprint $table) use ($tableName) {
            // Only drop index if it exists
            $indexName = 'idx_cover_processing';
            $indexes = Schema::connection($this->connection)->getConnection()
                ->select("SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?", [$indexName, $tableName]);
            if (!empty($indexes)) {
                $table->dropIndex($indexName);
            }
            
            // Only drop column if it exists
            if (Schema::connection($this->connection)->hasColumn($tableName, 'attempts')) {
                $table->dropColumn('attempts');
            }
        });
    }
};
