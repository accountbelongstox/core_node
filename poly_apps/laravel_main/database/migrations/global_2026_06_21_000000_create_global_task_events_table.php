<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

/**
 * Global task event log (append-only audit trail of task transitions).
 *
 * One row per transition written by TaskManagerService (assigned / processing /
 * completed / failed / timeout / reclaimed / cancelled). Lives on the same
 * (default) connection as global_tasks. Idempotent via SafeMigrationHelper —
 * re-running sys:init only ADDS missing columns/indexes and NEVER drops data
 * (matches the global_tasks / workers migration style).
 */
return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $tableName = 'global_task_events';
        $tableStructure = [
            'columns' => [
                'id'         => ['type' => 'bigIncrements'],
                'task_id'    => ['type' => 'string', 'nullable' => false, 'index' => true],
                'worker_id'  => ['type' => 'string', 'nullable' => true],
                'event'      => ['type' => 'string', 'nullable' => false, 'comment' => 'assigned|processing|completed|failed|timeout|reclaimed|cancelled'],
                'attempt'    => ['type' => 'unsignedInteger', 'nullable' => false, 'default' => 0],
                'detail'     => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
            ],
            'indexes' => [
                ['columns' => ['task_id']],
                ['columns' => ['created_at']],
                ['columns' => ['task_id', 'id'], 'name' => 'idx_task_event_order'],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $tableName,
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
        // Skip rollback - append-only audit table; drop manually if ever needed.
    }
};
