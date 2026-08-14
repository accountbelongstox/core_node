<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        // Neutralized: PassiveQueue was replaced by AppQyV1CoverGenerationTask,
        // but initialization never drops a table (empty or not). The legacy
        // table is left in place — dead, unread, harmless.
        return;
    }

    public function down(): void
    {
        // Recreate the table if rollback is needed
        $tableName = 'app_passive_queue_jobs';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'job_class' => ['type' => 'string', 'nullable' => false],
                'payload' => ['type' => 'json', 'nullable' => true],
                'status' => ['type' => 'string', 'nullable' => false, 'default' => 'pending'],
                'attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'error_message' => ['type' => 'text', 'nullable' => true],
                'available_at' => ['type' => 'timestamp', 'nullable' => true],
                'started_at' => ['type' => 'timestamp', 'nullable' => true],
                'finished_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['status', 'available_at']],
                ['columns' => ['job_class']],
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
};
