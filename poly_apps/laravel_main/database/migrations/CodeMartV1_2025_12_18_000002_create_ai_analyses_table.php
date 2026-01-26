<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'codemartv1';
    protected $tableName = 'codemart_v1_ai_analyses';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'project_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'status' => ['type' => 'enum', 'values' => ['processing', 'completed', 'revising', 'failed'], 'nullable' => false, 'default' => 'processing', 'index' => true],
                'keywords' => ['type' => 'text', 'nullable' => true],
                'recommended_languages' => ['type' => 'text', 'nullable' => true],
                'recommended_frameworks' => ['type' => 'text', 'nullable' => true],
                'recommended_databases' => ['type' => 'text', 'nullable' => true],
                'team_composition' => ['type' => 'text', 'nullable' => true],
                'estimated_hours' => ['type' => 'integer', 'nullable' => true],
                'estimated_cost' => ['type' => 'decimal', 'precision' => 10, 'scale' => 2, 'nullable' => true],
                'complexity_score' => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'nullable' => true],
                'proposal' => ['type' => 'text', 'nullable' => true],
                'revision_notes' => ['type' => 'text', 'nullable' => true],
                'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'accepted_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['project_id']],
                ['columns' => ['status']],
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
