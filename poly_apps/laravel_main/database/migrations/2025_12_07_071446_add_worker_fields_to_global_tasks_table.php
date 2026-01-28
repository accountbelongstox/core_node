<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $tableName = 'global_tasks';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_id' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'app_name' => ['type' => 'string', 'nullable' => false],
                'task_type' => ['type' => 'string', 'nullable' => true],
                'execution_type' => ['type' => 'string', 'nullable' => false, 'default' => 'local_timer'],
                'status' => ['type' => 'string', 'nullable' => false, 'default' => 'pending'],
                'assigned_to' => ['type' => 'string', 'nullable' => true],
                'assigned_at' => ['type' => 'timestamp', 'nullable' => true],
                'timeout_at' => ['type' => 'timestamp', 'nullable' => true],
                'timeout_seconds' => ['type' => 'integer', 'nullable' => false, 'default' => 120],
                'priority' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'retry_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'max_retries' => ['type' => 'integer', 'nullable' => false, 'default' => 3],
                'progress' => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'payload' => ['type' => 'json', 'nullable' => true],
                'steps' => ['type' => 'json', 'nullable' => true],
                'result' => ['type' => 'json', 'nullable' => true],
                'error' => ['type' => 'text', 'nullable' => true],
                'queue_item_id' => ['type' => 'string', 'nullable' => true],
                'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['app_name']],
                ['columns' => ['execution_type']],
                ['columns' => ['status']],
                ['columns' => ['assigned_to']],
                ['columns' => ['timeout_at']],
                ['columns' => ['priority']],
                ['columns' => ['queue_item_id']],
                ['columns' => ['status', 'execution_type', 'priority'], 'name' => 'idx_task_pulling'],
                ['columns' => ['status', 'timeout_at'], 'name' => 'idx_timeout_check'],
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
        // Skip rollback - this migration creates/updates essential tables
        // Rollback should be done manually if needed
    }
};
