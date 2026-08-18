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
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->table,
            [
                'columns' => [
                    'queue_position' => ['type' => 'bigInteger', 'default' => 0],
                ],
                'indexes' => [
                    [
                        'columns' => ['task_type', 'status', 'queue_position', 'created_at'],
                        'name' => 'idx_gt_type_status_queue_position',
                    ],
                ],
            ],
            ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
