<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'codemartv1';
    
    public function up(): void
    {
        $this->createReviewerApplicationsTable();
        $this->createCodeReviewsTable();
    }
    
    private function createReviewerApplicationsTable(): void
    {
        $tableName = 'codemart_v1_reviewer_applications';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'status' => ['type' => 'enum', 'values' => ['in_progress', 'passed', 'failed'], 'nullable' => false, 'default' => 'in_progress', 'index' => true],
                'test_cases' => ['type' => 'text', 'nullable' => false],
                'user_reviews' => ['type' => 'text', 'nullable' => true],
                'similarity_score' => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'nullable' => true],
                'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['status']],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }
    
    private function createCodeReviewsTable(): void
    {
        $tableName = 'codemart_v1_code_reviews';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'submission_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'reviewer_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'quality_rating' => ['type' => 'tinyInteger', 'nullable' => false],
                'readability_rating' => ['type' => 'tinyInteger', 'nullable' => false],
                'efficiency_rating' => ['type' => 'tinyInteger', 'nullable' => false],
                'comments' => ['type' => 'text', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['submission_id']],
                ['columns' => ['reviewer_id']],
                ['columns' => ['submission_id', 'reviewer_id'], 'unique' => true],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray($this->connection, $tableName, $tableStructure);
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('codemart_v1_code_reviews');
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists('codemart_v1_reviewer_applications');
    }
};
