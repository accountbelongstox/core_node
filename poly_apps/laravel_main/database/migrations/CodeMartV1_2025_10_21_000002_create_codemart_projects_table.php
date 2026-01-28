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
        $this->createProjectsTable();
        $this->createProjectProposalsTable();
        $this->createMilestonesTable();
        $this->createProjectAttachmentsTable();
    }

    private function createProjectsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'projects');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'client_id' => ['type' => 'foreignId', 'nullable' => false],
                'title' => ['type' => 'string', 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => false],
                'status' => ['type' => 'enum', 'values' => ['draft', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'], 'nullable' => false, 'default' => 'draft'],
                'complexity' => ['type' => 'enum', 'values' => ['simple', 'medium', 'complex', 'very_complex'], 'nullable' => false, 'default' => 'medium'],
                'budget' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'budget_type' => ['type' => 'enum', 'values' => ['fixed', 'hourly'], 'nullable' => false, 'default' => 'fixed'],
                'currency' => ['type' => 'string', 'nullable' => false, 'default' => 'CNY'],
                'start_date' => ['type' => 'date', 'nullable' => true],
                'end_date' => ['type' => 'date', 'nullable' => true],
                'skills' => ['type' => 'json', 'nullable' => true],
                'languages' => ['type' => 'json', 'nullable' => true],
                'frameworks' => ['type' => 'json', 'nullable' => true],
                'databases' => ['type' => 'json', 'nullable' => true],
                'reference_urls' => ['type' => 'json', 'nullable' => true],
                'total_milestones' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'completed_milestones' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['client_id']],
                ['columns' => ['status']],
                ['columns' => ['complexity']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'client_id',
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

    private function createProjectProposalsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'project_proposals');
        $projectsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'projects');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'project_id' => ['type' => 'foreignId', 'nullable' => false, 'unique' => true],
                'status' => ['type' => 'enum', 'values' => ['draft', 'pending', 'approved', 'rejected', 'revised'], 'nullable' => false, 'default' => 'pending'],
                'recommended_tech_stack' => ['type' => 'json', 'nullable' => true],
                'suggested_team_composition' => ['type' => 'json', 'nullable' => true],
                'estimated_duration' => ['type' => 'integer', 'nullable' => true],
                'estimated_cost' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => true],
                'cost_breakdown' => ['type' => 'json', 'nullable' => true],
                'ai_notes' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'foreignKeys' => [
                [
                    'column' => 'project_id',
                    'references' => $projectsTableName,
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

    private function createMilestonesTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'milestones');
        $projectsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'projects');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'project_id' => ['type' => 'foreignId', 'nullable' => false],
                'title' => ['type' => 'string', 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => true],
                'status' => ['type' => 'enum', 'values' => ['pending', 'in_progress', 'completed', 'failed', 'cancelled'], 'nullable' => false, 'default' => 'pending'],
                'order' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'due_date' => ['type' => 'date', 'nullable' => false],
                'budget' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                'deliverables' => ['type' => 'json', 'nullable' => true],
                'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['project_id', 'order']],
                ['columns' => ['status']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'project_id',
                    'references' => $projectsTableName,
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

    private function createProjectAttachmentsTable(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'project_attachments');
        $projectsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'projects');
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'project_id' => ['type' => 'foreignId', 'nullable' => false],
                'file_name' => ['type' => 'string', 'nullable' => false],
                'original_name' => ['type' => 'string', 'nullable' => false],
                'mime_type' => ['type' => 'string', 'nullable' => false],
                'size' => ['type' => 'integer', 'nullable' => false],
                'path' => ['type' => 'string', 'nullable' => false],
                'uploaded_by' => ['type' => 'foreignId', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['project_id']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'project_id',
                    'references' => $projectsTableName,
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
                [
                    'column' => 'uploaded_by',
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
        $tables = [
            'project_attachments',
            'milestones',
            'project_proposals',
            'projects',
        ];
        
        foreach ($tables as $tableSuffix) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, $tableSuffix);
            Schema::connection($this->connection)->dropIfExists($tableName);
        }
    }
};
