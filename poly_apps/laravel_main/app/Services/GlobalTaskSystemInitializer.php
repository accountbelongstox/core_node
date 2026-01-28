<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\GlobalTask;
use App\Models\Worker;

class GlobalTaskSystemInitializer
{
    /**
     * Ensure global task system tables exist and are properly configured
     *
     * @return array Initialization results
     */
    public static function ensureTablesExist(): array
    {
        $results = [];

        // Step 1: Check and add fields to global_tasks table
        $results['global_tasks'] = self::ensureGlobalTasksTableUpdated();

        // Step 2: Check and create workers table
        $results['workers'] = self::ensureWorkersTableExists();

        return $results;
    }

    /**
     * Ensure global_tasks table exists with all required fields
     *
     * @return string Status: 'created', 'updated', 'exists', or 'error'
     */
    private static function ensureGlobalTasksTableUpdated(): string
    {
        try {
            $connection = config('database.default');

            // Check if table exists at all
            if (!Schema::connection($connection)->hasTable('global_tasks')) {
                // Create complete table from scratch
                Schema::connection($connection)->create('global_tasks', function ($table) {
                    $table->bigIncrements('id');
                    $table->string('task_id')->unique();
                    $table->string('app_name')->index();
                    $table->string('task_type')->nullable();
                    $table->string('execution_type')->default('local_timer')->index();
                    $table->string('status')->default('pending')->index();
                    $table->string('assigned_to')->nullable()->index();
                    $table->timestamp('assigned_at')->nullable();
                    $table->timestamp('timeout_at')->nullable()->index();
                    $table->integer('timeout_seconds')->default(120);
                    $table->integer('priority')->default(0)->index();
                    $table->integer('retry_count')->default(0);
                    $table->integer('max_retries')->default(3);
                    $table->decimal('progress', 5, 2)->default(0);
                    $table->json('payload')->nullable();
                    $table->json('steps')->nullable();
                    $table->json('result')->nullable();
                    $table->text('error')->nullable();
                    $table->string('queue_item_id')->nullable()->index();
                    $table->timestamps();

                    // Composite indexes for efficient task pulling
                    $table->index(['status', 'execution_type', 'priority'], 'idx_task_pulling');
                    $table->index(['status', 'timeout_at'], 'idx_timeout_check');
                });

                return 'created';
            }

            // Table exists, check if worker fields exist
            $hasExecutionType = Schema::connection($connection)->hasColumn('global_tasks', 'execution_type');
            $hasAssignedTo = Schema::connection($connection)->hasColumn('global_tasks', 'assigned_to');
            $hasTimeout = Schema::connection($connection)->hasColumn('global_tasks', 'timeout_at');
            $hasPriority = Schema::connection($connection)->hasColumn('global_tasks', 'priority');

            if ($hasExecutionType && $hasAssignedTo && $hasTimeout && $hasPriority) {
                return 'exists';
            }

            // Add missing fields to existing table
            Schema::connection($connection)->table('global_tasks', function ($table) use (
                $hasExecutionType,
                $hasAssignedTo,
                $hasTimeout,
                $hasPriority
            ) {
                if (!$hasExecutionType) {
                    $table->string('execution_type')->default('local_timer')->after('task_type')->index();
                }

                if (!$hasAssignedTo) {
                    $table->string('assigned_to')->nullable()->after('status')->index();
                    $table->timestamp('assigned_at')->nullable()->after('assigned_to');
                }

                if (!$hasTimeout) {
                    $table->timestamp('timeout_at')->nullable()->after('assigned_at')->index();
                    $table->integer('timeout_seconds')->default(120)->after('timeout_at');
                }

                if (!$hasPriority) {
                    $table->integer('priority')->default(0)->after('timeout_seconds')->index();
                    $table->integer('retry_count')->default(0)->after('priority');
                    $table->integer('max_retries')->default(3)->after('retry_count');
                }
            });

            return 'updated';

        } catch (\Exception $e) {
            return 'error: ' . $e->getMessage();
        }
    }

    /**
     * Ensure workers table exists
     *
     * @return string Status: 'created', 'exists', or 'error'
     */
    private static function ensureWorkersTableExists(): string
    {
        try {
            $connection = config('database.default');

            // Check if table exists
            if (Schema::connection($connection)->hasTable('workers')) {
                return 'exists';
            }

            // Create workers table
            Schema::connection($connection)->create('workers', function ($table) {
                $table->bigIncrements('id');
                $table->string('worker_id')->unique();
                $table->string('worker_name');
                $table->json('processor_types'); // Array of execution types
                $table->enum('status', ['online', 'offline', 'busy'])->default('offline');
                $table->timestamp('last_heartbeat_at')->nullable();
                $table->string('hostname')->nullable();
                $table->string('platform')->nullable();
                $table->json('metadata')->nullable();
                $table->integer('completed_tasks')->default(0);
                $table->integer('failed_tasks')->default(0);
                $table->string('current_task_id')->nullable();
                $table->timestamps();

                // Indexes
                $table->index(['status', 'last_heartbeat_at'], 'idx_worker_status');
            });

            return 'created';

        } catch (\Exception $e) {
            return 'error: ' . $e->getMessage();
        }
    }

    /**
     * Get table statistics
     *
     * @return array Statistics
     */
    public static function getTableStats(): array
    {
        $stats = [];

        try {
            $connection = config('database.default');

            // Global tasks stats
            if (Schema::connection($connection)->hasTable('global_tasks')) {
                // Use model connection for query builder (Laravel best practice)
                $taskModel = new GlobalTask();
                $taskModel->setConnection($connection);
                $dbConnection = $taskModel->getConnection();
                
                $stats['global_tasks'] = [
                    'total' => $dbConnection->table('global_tasks')->count(),
                    'pending' => $dbConnection->table('global_tasks')->where('status', 'pending')->count(),
                    'processing' => $dbConnection->table('global_tasks')->where('status', 'processing')->count(),
                    'completed' => $dbConnection->table('global_tasks')->where('status', 'completed')->count(),
                    'failed' => $dbConnection->table('global_tasks')->where('status', 'failed')->count(),
                ];
            }

            // Workers stats
            if (Schema::connection($connection)->hasTable('workers')) {
                // Use model connection for query builder (Laravel best practice)
                $workerModel = new Worker();
                $workerModel->setConnection($connection);
                $dbConnection = $workerModel->getConnection();
                
                $stats['workers'] = [
                    'total' => $dbConnection->table('workers')->count(),
                    'online' => $dbConnection->table('workers')->where('status', 'online')->count(),
                    'busy' => $dbConnection->table('workers')->where('status', 'busy')->count(),
                    'offline' => $dbConnection->table('workers')->where('status', 'offline')->count(),
                ];
            }

        } catch (\Exception $e) {
            $stats['error'] = $e->getMessage();
        }

        return $stats;
    }
}
