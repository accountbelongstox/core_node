<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'codemartv1';

    public function up(): void
    {
        $this->createTasksTable();
        $this->createTaskSubmissionsTable();
        $this->createTaskCommentsTable();
        $this->createCodeReviewsTable();
    }

    private function createTasksTable(): void
    {
        $tableName = 'codemart_v1_tasks';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'milestone_id' => ['type' => 'foreignId', 'nullable' => false],
                'title' => ['type' => 'string', 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['pending', 'in_progress', 'review', 'completed', 'blocked'], 'nullable' => false, 'default' => 'pending'],
                'priority' => ['type' => 'enum', 'values' => ['low', 'medium', 'high', 'urgent'], 'nullable' => false, 'default' => 'medium'],
                'assigned_to' => ['type' => 'foreignId', 'nullable' => true],
                'due_date' => ['type' => 'dateTime', 'nullable' => true],
                'deliverables' => ['type' => 'json', 'nullable' => true],
                'budget_allocation' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => true],
                'order' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['milestone_id']],
                ['columns' => ['assigned_to']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'milestone_id',
                    'references' => 'codemart_v1_milestones',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'assigned_to',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'set null',
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

    private function createTaskSubmissionsTable(): void
    {
        $tableName = 'codemart_v1_task_submissions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_id' => ['type' => 'foreignId', 'nullable' => false],
                'submitted_by' => ['type' => 'foreignId', 'nullable' => false],
                'submission_note' => ['type' => 'text', 'nullable' => true],
                'files' => ['type' => 'json', 'nullable' => true],
                'status' => ['type' => 'enum', 'values' => ['pending', 'approved', 'rejected', 'needs_revision'], 'nullable' => false, 'default' => 'pending'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['task_id']],
                ['columns' => ['submitted_by']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'task_id',
                    'references' => 'codemart_v1_tasks',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'submitted_by',
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

    private function createTaskCommentsTable(): void
    {
        $tableName = 'codemart_v1_task_comments';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_id' => ['type' => 'foreignId', 'nullable' => false],
                'user_id' => ['type' => 'foreignId', 'nullable' => false],
                'comment' => ['type' => 'text', 'nullable' => false],
                'mentions' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['task_id']],
                ['columns' => ['user_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'task_id',
                    'references' => 'codemart_v1_tasks',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'user_id',
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

    private function createCodeReviewsTable(): void
    {
        $tableName = 'codemart_v1_code_reviews';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_submission_id' => ['type' => 'foreignId', 'nullable' => false],
                'reviewer_id' => ['type' => 'foreignId', 'nullable' => false],
                'review_notes' => ['type' => 'text', 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['approved', 'needs_revision', 'rejected'], 'nullable' => false, 'default' => 'needs_revision'],
                'rating' => ['type' => 'integer', 'nullable' => true],
                'line_comments' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['task_submission_id']],
                ['columns' => ['reviewer_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'task_submission_id',
                    'references' => 'codemart_v1_task_submissions',
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
        Schema::connection($this->connection)->dropIfExists('codemart_v1_code_reviews');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_task_comments');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_task_submissions');
        Schema::connection($this->connection)->dropIfExists('codemart_v1_tasks');
    }
};
