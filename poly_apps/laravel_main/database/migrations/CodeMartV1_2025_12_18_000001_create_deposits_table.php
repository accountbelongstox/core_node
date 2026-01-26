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
        $tableName = 'codemart_v1_deposits';
        $connection = 'codemartv1';
        
        // Create table if it doesn't exist (idempotent)
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('role_type');
                $table->decimal('amount', 10, 2);
                $table->string('payment_method');
                $table->enum('status', ['pending', 'paid', 'failed', 'refunded'])->default('pending');
                $table->string('payment_url')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();

                $table->index('user_id');
                $table->index('status');
            });
            return; // Table created, exit early
        }
        
        // Table exists, check and add missing columns (idempotent, preserves existing data)
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnsMap = array_flip($columns);
        
        // Add missing columns using Laravel Schema (preserves existing data)
        Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($columnsMap) {
            if (!isset($columnsMap['user_id'])) {
                $table->unsignedBigInteger('user_id')->index()->after('id');
            }
            if (!isset($columnsMap['role_type'])) {
                $table->string('role_type')->after('user_id');
            }
            if (!isset($columnsMap['amount'])) {
                $table->decimal('amount', 10, 2)->after('role_type');
            }
            if (!isset($columnsMap['payment_method'])) {
                $table->string('payment_method')->after('amount');
            }
            if (!isset($columnsMap['status'])) {
                $table->enum('status', ['pending', 'paid', 'failed', 'refunded'])->default('pending')->index()->after('payment_method');
            }
            if (!isset($columnsMap['payment_url'])) {
                $table->string('payment_url')->nullable()->after('status');
            }
            if (!isset($columnsMap['paid_at'])) {
                $table->timestamp('paid_at')->nullable()->after('payment_url');
            }
            if (!isset($columnsMap['created_at'])) {
                $table->timestamp('created_at')->nullable()->after('paid_at');
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
        if (isset($columnsMap['user_id']) && !isset($indexMap['codemart_v1_deposits_user_id_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS codemart_v1_deposits_user_id_index ON {$tableName}(user_id)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
        
        if (isset($columnsMap['status']) && !isset($indexMap['codemart_v1_deposits_status_index'])) {
            try {
                \Illuminate\Support\Facades\DB::connection($connection)->statement(
                    "CREATE INDEX IF NOT EXISTS codemart_v1_deposits_status_index ON {$tableName}(status)"
                );
            } catch (\Exception $e) {
                // Index might already exist, skip
            }
        }
    }

    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_deposits');
    }
};
