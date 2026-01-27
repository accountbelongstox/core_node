<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::CODEMARTV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }
    
    public function up(): void
    {
        $this->createReviewerApplicationsTable();
        $this->createReviewerCodeReviewsTable();
    }
    
    private function createReviewerApplicationsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'reviewer_applications');
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
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }
    
    private function createReviewerCodeReviewsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'reviewer_code_reviews');
        $taskSubmissionsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'task_submissions');
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
            'foreignKeys' => [
                [
                    'column' => 'submission_id',
                    'references' => $taskSubmissionsTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'reviewer_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
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
        $reviewerCodeReviewsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'reviewer_code_reviews');
        $reviewerApplicationsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'reviewer_applications');
        
        Schema::connection($this->connection)->dropIfExists($reviewerCodeReviewsTableName);
        Schema::connection($this->connection)->dropIfExists($reviewerApplicationsTableName);
    }
};
