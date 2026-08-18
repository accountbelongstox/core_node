<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Gemini text-completion answer store.
 *
 * Lightweight text record written when a `gemini_chat` global task completes
 * (chrome Task Center worker -> POST /api/worker/tasks/result ->
 * GeminiTextTaskProcessor). Mirrors app_qy_v1_notebooklm_results: one row =
 * one answered prompt { question, answer, provider, task_id }. `answer` holds
 * the model's raw text reply (a JSON block when the prompt asked for
 * structured output, e.g. app_qy_v1_ai_prompts.response_schema) -- parsing is
 * the READER's job, this table stores the text verbatim.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'gemini_text_results');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'task_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'index' => true, 'comment' => 'Originating global task id'],
                'title' => ['type' => 'string', 'length' => 255, 'nullable' => true],
                'question' => ['type' => 'text', 'nullable' => true, 'comment' => 'Rendered prompt submitted to Gemini'],
                'answer' => ['type' => 'text', 'nullable' => true, 'comment' => 'Gemini text reply (raw; a JSON block for structured prompts)'],
                'provider' => ['type' => 'string', 'length' => 40, 'nullable' => true, 'comment' => "Result provider label, e.g. 'gemini'"],
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
