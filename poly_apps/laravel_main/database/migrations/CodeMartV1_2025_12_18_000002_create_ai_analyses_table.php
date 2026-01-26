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
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::CODEMARTV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'ai_analyses');
    }

    public function up(): void
    {
        $projectsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'projects');
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
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
