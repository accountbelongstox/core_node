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

        // Step 3: Check and create the append-only task event log table.
        $results['global_task_events'] = self::ensureGlobalTaskEventsTableExists();

        return $results;
    }

    /**
     * Ensure global_task_events table exists (append-only task transition log).
     *
     * Mirrors the migration global_2026_06_21_000000_create_global_task_events_table:
     * one row per task transition (assigned/processing/completed/failed/timeout/
     * reclaimed/cancelled) written by TaskManagerService. Same shared-helper,
     * add-only, idempotent alignment as global_tasks/workers.
     *
     * @return string Status: 'created', 'updated', 'exists', or 'error'
     */
    private static function ensureGlobalTaskEventsTableExists(): string
    {
        try {
            $connection = config('database.default');

            $structure = [
                'columns' => [
                    'id'         => ['type' => 'bigIncrements'],
                    'task_id'    => ['type' => 'string', 'index' => true],
                    'worker_id'  => ['type' => 'string', 'nullable' => true],
                    'event'      => ['type' => 'string'],
                    'attempt'    => ['type' => 'unsignedInteger', 'default' => 0],
                    'detail'     => ['type' => 'json', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                ],
                'indexes' => [
                    ['columns' => ['task_id', 'id'], 'name' => 'idx_task_event_order'],
                ],
            ];

            $result = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                'global_task_events',
                $structure,
                ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
            );

            $status = $result['status'] ?? 'error';
            return $status === 'aligned' ? 'exists' : $status; // created|updated|exists
        } catch (\Exception $e) {
            return 'error: ' . $e->getMessage();
        }
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

            // Canonical structure -> create-if-missing + ALTER-add ANY missing column/
            // index via the shared helper (DRY; no hardcoded per-column `if` align).
            // Add-only (modify_columns=false): never rewrite/drop existing columns or
            // touch existing task rows (the table can hold thousands of live tasks).
            $structure = [
                'columns' => [
                    'id'              => ['type' => 'bigIncrements'],
                    'task_id'         => ['type' => 'string', 'unique' => true],
                    'app_name'        => ['type' => 'string', 'index' => true],
                    'task_type'       => ['type' => 'string', 'nullable' => true],
                    'execution_type'  => ['type' => 'string', 'default' => 'local_timer', 'index' => true],
                    'status'          => ['type' => 'string', 'default' => 'pending', 'index' => true],
                    'assigned_to'     => ['type' => 'string', 'nullable' => true, 'index' => true],
                    'assigned_at'     => ['type' => 'timestamp', 'nullable' => true],
                    'timeout_at'      => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                    'timeout_seconds' => ['type' => 'integer', 'default' => 120],
                    'priority'        => ['type' => 'integer', 'default' => 0, 'index' => true],
                    'retry_count'     => ['type' => 'integer', 'default' => 0],
                    'max_retries'     => ['type' => 'integer', 'default' => 3],
                    'progress'        => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'default' => 0],
                    'payload'         => ['type' => 'json', 'nullable' => true],
                    'steps'           => ['type' => 'json', 'nullable' => true],
                    'result'          => ['type' => 'json', 'nullable' => true],
                    'error'           => ['type' => 'text', 'nullable' => true],
                    'queue_item_id'   => ['type' => 'string', 'nullable' => true, 'index' => true],
                    'created_at'      => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at'      => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status', 'execution_type', 'priority'], 'name' => 'idx_task_pulling'],
                    ['columns' => ['status', 'timeout_at'], 'name' => 'idx_timeout_check'],
                ],
            ];

            $result = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                'global_tasks',
                $structure,
                ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
            );

            $status = $result['status'] ?? 'error';
            return $status === 'aligned' ? 'exists' : $status; // created|updated|exists
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

            // Same shared-helper alignment as global_tasks (DRY, add-only, idempotent).
            $structure = [
                'columns' => [
                    'id'                => ['type' => 'bigIncrements'],
                    'worker_id'         => ['type' => 'string', 'unique' => true],
                    'worker_name'       => ['type' => 'string'],
                    'processor_types'   => ['type' => 'json'],
                    'status'            => ['type' => 'enum', 'values' => ['online', 'offline', 'busy'], 'default' => 'offline'],
                    'last_heartbeat_at' => ['type' => 'timestamp', 'nullable' => true],
                    'hostname'          => ['type' => 'string', 'nullable' => true],
                    'platform'          => ['type' => 'string', 'nullable' => true],
                    'metadata'          => ['type' => 'json', 'nullable' => true],
                    'completed_tasks'   => ['type' => 'integer', 'default' => 0],
                    'failed_tasks'      => ['type' => 'integer', 'default' => 0],
                    'current_task_id'   => ['type' => 'string', 'nullable' => true],
                    'created_at'        => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at'        => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status', 'last_heartbeat_at'], 'name' => 'idx_worker_status'],
                ],
            ];

            $result = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                'workers',
                $structure,
                ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
            );

            $status = $result['status'] ?? 'error';
            return $status === 'aligned' ? 'exists' : $status; // created|updated|exists
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
