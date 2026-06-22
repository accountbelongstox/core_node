<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * NotebookLM answer store.
 *
 * Lightweight text record written when a `notebooklm` global task completes
 * (chrome Task Center worker -> POST /api/worker/tasks/result ->
 * NotebookLmTaskProcessor). One row = one answered question:
 *   { question, answer, notebook_url, provider, task_id }.
 *
 * Idempotent via SafeMigrationHelper - re-running sys:init only ADDS missing
 * columns/indexes and NEVER drops data.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'notebooklm_results');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'index' => true, 'comment' => 'Originating global task id'],
                'title' => ['type' => 'string', 'length' => 255, 'nullable' => true, 'comment' => 'Optional human title'],
                'question' => ['type' => 'text', 'nullable' => true, 'comment' => 'Question / source_text submitted to NotebookLM'],
                'answer' => ['type' => 'text', 'nullable' => true, 'comment' => 'NotebookLM answer text'],
                'notebook_url' => ['type' => 'string', 'length' => 1024, 'nullable' => true, 'comment' => 'Source / created notebook URL'],
                'provider' => ['type' => 'string', 'length' => 40, 'nullable' => true, 'comment' => "Result provider label, e.g. 'notebooklm'"],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['task_id']],
                ['columns' => ['created_at']],
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
