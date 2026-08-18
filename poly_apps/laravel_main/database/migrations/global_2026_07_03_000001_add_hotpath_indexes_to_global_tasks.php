<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

/**
 * Hot-path indexes for global_tasks (Task Center query optimization).
 *
 * The Task Center shell + Queue/Workers tab poll list/history endpoints every
 * ~5s. Those queries filter by status / task_type and ORDER BY created_at, but
 * global_tasks only had (status, execution_type, priority) and single-column
 * indexes — so an "ORDER BY created_at DESC" or a task_type filter fell back to
 * a full scan + filesort over the ever-growing table. On the single-worker
 * `php artisan serve` runtime one such scan serializes ahead of every other
 * request. These add-only indexes back the polled predicates:
 *   - (status, created_at)  : status-filtered recent list, index-ordered LIMIT.
 *   - (created_at)          : the unfiltered "all / recent" list ordering.
 *   - (task_type, status)   : DevHistory assist summary() + other task_type
 *                             filtered status roll-ups (index-only aggregate).
 *
 * Add-only via SafeMigrationHelper (idempotent; safe on an existing DB).
 */
return new class extends Migration
{
    protected $connection;
    protected string $table = 'global_tasks';

    public function __construct()
    {
        $this->connection = (string) config('database.default');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['status', 'created_at'],
            'idx_gt_status_created'
        );

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['created_at'],
            'idx_gt_created'
        );

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['task_type', 'status'],
            'idx_gt_tasktype_status'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
