<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use App\Constants\DbConnections;
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

        // Step 4: Partial unique index backing Queue Center group_key dedup.
        $results['global_tasks_group_dedup'] = self::ensureLiveGroupKeyDedupIndex();

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
            $connection = DbConnections::MAIN;

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
        } catch (\Throwable $e) {
            return 'error: ' . $e->getMessage();
        }
    }

    /**
     * Partial unique index that makes Queue Center group_key dedup atomic:
     * at most one LIVE (pending/assigned/processing) row per (task_type,
     * group_key). Terminal rows are excluded so retry/re-enqueue stays free.
     *
     * SELF-HEALING: legacy duplicate live rows would reject the unique index,
     * so they are repaired first — redundant rows (all but the newest per
     * group, the same winner QueueCenterService::findLiveByDedupKey picks)
     * are cancelled through the canonical TaskManagerService::cancelTask path
     * in bounded rounds. Idempotent: a clean database repairs nothing and the
     * index probe makes re-runs no-ops.
     *
     * @return string Status: 'created', 'exists', 'skipped: ...', or 'error: ...'
     */
    private const GROUP_DEDUP_INDEX = 'idx_global_tasks_live_group_key';
    private const GROUP_DEDUP_REPAIR_ROUNDS = 10;

    private static function ensureLiveGroupKeyDedupIndex(): string
    {
        try {
            $connection = DbConnections::MAIN;
            if (!Schema::connection($connection)->hasTable('global_tasks')) {
                return 'skipped: global_tasks missing';
            }

            $cancelledTotal = 0;
            $taskManager = app(TaskManagerService::class);
            for ($round = 0; $round < self::GROUP_DEDUP_REPAIR_ROUNDS; $round++) {
                $redundant = GlobalTask::redundantLiveGroupKeyTaskKeys();
                if ($redundant === []) {
                    break;
                }
                foreach ($redundant as $taskId) {
                    // 'not_cancellable' means a worker already moved the row
                    // out of live status concurrently — the next round's
                    // duplicate scan simply no longer sees it.
                    if ($taskManager->cancelTask($taskId) === 'cancelled') {
                        $cancelledTotal++;
                    }
                }
            }
            if (GlobalTask::redundantLiveGroupKeyTaskKeys() !== []) {
                return 'error: duplicate live group_key rows remain after repair';
            }
            if ($cancelledTotal > 0) {
                Log::info('[GlobalTaskSystemInitializer] Repaired duplicate live group_key tasks', [
                    'cancelled' => $cancelledTotal,
                ]);
            }

            $liveStatuses = GlobalTask::statuses('live');
            $statusList = implode(', ', array_map(
                static fn (string $status): string => "'" . str_replace("'", "''", $status) . "'",
                $liveStatuses
            ));

            $result = SafeMigrationHelper::safeAddPgPartialIndex(
                $connection,
                'global_tasks',
                self::GROUP_DEDUP_INDEX,
                ['task_type', 'group_key'],
                "group_key IS NOT NULL AND status IN ({$statusList})",
                true
            );

            $status = (string) ($result['status'] ?? 'error');
            if ($status === 'added') {
                return 'created';
            }
            if ($status === 'exists') {
                return 'exists';
            }
            return 'error: ' . (string) ($result['message'] ?? 'partial index creation failed');
        } catch (\Throwable $e) {
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
            $connection = DbConnections::MAIN;

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
                    'queue_position'  => ['type' => 'bigInteger', 'default' => 0],
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
                    ['columns' => ['task_type', 'status', 'queue_position', 'created_at'], 'name' => 'idx_gt_type_status_queue_position'],
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
        } catch (\Throwable $e) {
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
            $connection = DbConnections::MAIN;

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
        } catch (\Throwable $e) {
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
            $connection = DbConnections::MAIN;

            // Global tasks stats
            if (Schema::connection($connection)->hasTable('global_tasks')) {
                $stats['global_tasks'] = GlobalTask::initializationStats();
            }

            // Workers stats
            if (Schema::connection($connection)->hasTable('workers')) {
                $stats['workers'] = Worker::initializationStats();
            }

        } catch (\Throwable $e) {
            $stats['error'] = $e->getMessage();
        }

        return $stats;
    }
}
