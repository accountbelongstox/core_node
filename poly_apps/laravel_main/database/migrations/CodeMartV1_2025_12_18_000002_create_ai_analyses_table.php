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
        $tableName = 'codemart_v1_ai_analyses';
        $connection = 'codemartv1';
        
        // Create table if it doesn't exist (idempotent)
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('project_id');
                $table->enum('status', ['processing', 'completed', 'revising', 'failed'])->default('processing');
                $table->text('keywords')->nullable();
                $table->text('recommended_languages')->nullable();
                $table->text('recommended_frameworks')->nullable();
                $table->text('recommended_databases')->nullable();
                $table->text('team_composition')->nullable();
                $table->integer('estimated_hours')->nullable();
                $table->decimal('estimated_cost', 10, 2)->nullable();
                $table->decimal('complexity_score', 5, 2)->nullable();
                $table->text('proposal')->nullable();
                $table->text('revision_notes')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamp('accepted_at')->nullable();
                $table->timestamps();

                $table->index('project_id');
                $table->index('status');
            });
            return; // Table created, exit early
        }
        
        // Table exists, check and add missing columns (idempotent, preserves existing data)
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        // Add missing columns using Laravel Schema (preserves existing data)
        Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            if (!isset($columnsMap['project_id'])) {
                $table->unsignedBigInteger('project_id')->index()->after('id');
            }
            if (!isset($columnsMap['status'])) {
                $table->enum('status', ['processing', 'completed', 'revising', 'failed'])->default('processing')->index()->after('project_id');
            }
            if (!isset($columnsMap['keywords'])) {
                $table->text('keywords')->nullable()->after('status');
            }
            if (!isset($columnsMap['recommended_languages'])) {
                $table->text('recommended_languages')->nullable()->after('keywords');
            }
            if (!isset($columnsMap['recommended_frameworks'])) {
                $table->text('recommended_frameworks')->nullable()->after('recommended_languages');
            }
            if (!isset($columnsMap['recommended_databases'])) {
                $table->text('recommended_databases')->nullable()->after('recommended_frameworks');
            }
            if (!isset($columnsMap['team_composition'])) {
                $table->text('team_composition')->nullable()->after('recommended_databases');
            }
            if (!isset($columnsMap['estimated_hours'])) {
                $table->integer('estimated_hours')->nullable()->after('team_composition');
            }
            if (!isset($columnsMap['estimated_cost'])) {
                $table->decimal('estimated_cost', 10, 2)->nullable()->after('estimated_hours');
            }
            if (!isset($columnsMap['complexity_score'])) {
                $table->decimal('complexity_score', 5, 2)->nullable()->after('estimated_cost');
            }
            if (!isset($columnsMap['proposal'])) {
                $table->text('proposal')->nullable()->after('complexity_score');
            }
            if (!isset($columnsMap['revision_notes'])) {
                $table->text('revision_notes')->nullable()->after('proposal');
            }
            if (!isset($columnsMap['completed_at'])) {
                $table->timestamp('completed_at')->nullable()->after('revision_notes');
            }
            if (!isset($columnsMap['accepted_at'])) {
                $table->timestamp('accepted_at')->nullable()->after('completed_at');
            }
            if (!isset($columnsMap['created_at'])) {
                $table->timestamp('created_at')->nullable()->after('accepted_at');
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
        if (isset($columnsMap['project_id']) && !isset($indexMap['codemart_v1_ai_analyses_project_id_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS codemart_v1_ai_analyses_project_id_index ON {$tableName}(project_id)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['status']) && !isset($indexMap['codemart_v1_ai_analyses_status_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS codemart_v1_ai_analyses_status_index ON {$tableName}(status)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
    }

    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_ai_analyses');
    }
};
