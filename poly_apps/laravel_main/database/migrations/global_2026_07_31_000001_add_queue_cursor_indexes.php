<?php

use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;

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
            ['status', 'id'],
            'idx_gt_status_id'
        );

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['app_name', 'task_type', 'status', 'priority', 'created_at'],
            'idx_gt_app_type_status_priority_created'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
