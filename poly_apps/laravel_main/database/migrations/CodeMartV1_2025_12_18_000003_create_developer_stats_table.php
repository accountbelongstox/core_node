<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (idempotent - preserves existing data)
     * 
     * Behavior:
     * - If table doesn't exist: Creates the table with all required columns
     * - If table exists: Checks for missing columns and adds them (preserves data)
     * - If table exists with all columns: Skips (no changes)
     */
    public function up(): void
    {
        $tableName = 'codemart_v1_developer_stats';
        $connection = 'codemartv1';
        
        // Create table if it doesn't exist (idempotent)
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->integer('completed_projects')->default(0);
                $table->decimal('avg_code_score', 5, 2)->default(0);
                $table->decimal('avg_client_satisfaction', 3, 2)->default(0);
                $table->decimal('total_earnings', 10, 2)->default(0);
                $table->decimal('on_time_delivery_rate', 5, 2)->default(0);
                $table->timestamps();

                $table->index('user_id');
            });
            return; // Table created, exit early
        }
        
        // Table exists, check and add missing columns (idempotent, preserves existing data)
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        // Add missing columns using Laravel Schema (preserves existing data)
        Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            if (!isset($columnsMap['user_id'])) {
                $table->unsignedBigInteger('user_id')->unique()->index()->after('id');
            }
            if (!isset($columnsMap['completed_projects'])) {
                $table->integer('completed_projects')->default(0)->after('user_id');
            }
            if (!isset($columnsMap['avg_code_score'])) {
                $table->decimal('avg_code_score', 5, 2)->default(0)->after('completed_projects');
            }
            if (!isset($columnsMap['avg_client_satisfaction'])) {
                $table->decimal('avg_client_satisfaction', 3, 2)->default(0)->after('avg_code_score');
            }
            if (!isset($columnsMap['total_earnings'])) {
                $table->decimal('total_earnings', 10, 2)->default(0)->after('avg_client_satisfaction');
            }
            if (!isset($columnsMap['on_time_delivery_rate'])) {
                $table->decimal('on_time_delivery_rate', 5, 2)->default(0)->after('total_earnings');
            }
            if (!isset($columnsMap['created_at'])) {
                $table->timestamp('created_at')->nullable()->after('on_time_delivery_rate');
            }
            if (!isset($columnsMap['updated_at'])) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });
        
        // Ensure indexes exist (idempotent)
        $this->ensureIndexes($tableName, $columnsMap, $connection);
    }
    
    /**
     * Ensure required indexes exist (idempotent)
     */
    private function ensureIndexes(string $tableName, array $columnsMap, string $connection): void
    {
        // Get existing indexes
        $indexes = \Illuminate\Support\Facades\DB::connection($connection)->select("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='{$tableName}'");
        $indexNames = array_column($indexes, 'name');
        $indexMap = array_flip($indexNames);
        
        // Add indexes if columns exist but indexes don't
        if (isset($columnsMap['user_id']) && !isset($indexMap['codemart_v1_developer_stats_user_id_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS codemart_v1_developer_stats_user_id_index ON {$tableName}(user_id)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
    }

    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_developer_stats');
    }
};
