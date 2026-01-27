<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $tableName = 'workers';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'worker_id' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'worker_name' => ['type' => 'string', 'nullable' => false],
                'processor_types' => ['type' => 'json', 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['online', 'offline', 'busy'], 'nullable' => false, 'default' => 'offline'],
                'last_heartbeat_at' => ['type' => 'timestamp', 'nullable' => true],
                'hostname' => ['type' => 'string', 'nullable' => true],
                'platform' => ['type' => 'string', 'nullable' => true],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'completed_tasks' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'failed_tasks' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'current_task_id' => ['type' => 'string', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['status']],
                ['columns' => ['last_heartbeat_at']],
                ['columns' => ['status', 'last_heartbeat_at'], 'name' => 'idx_worker_status'],
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
        $connection = $this->connection ?? config('database.default');
        Schema::connection($connection)->dropIfExists('workers');
    }
};
