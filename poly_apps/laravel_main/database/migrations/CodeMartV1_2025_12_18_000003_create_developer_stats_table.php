<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'codemartv1';
    protected $tableName = 'codemart_v1_developer_stats';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'unique' => true, 'index' => true],
                'completed_projects' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'avg_code_score' => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'avg_client_satisfaction' => ['type' => 'decimal', 'precision' => 3, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'total_earnings' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'on_time_delivery_rate' => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'nullable' => false, 'default' => 0],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
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
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
