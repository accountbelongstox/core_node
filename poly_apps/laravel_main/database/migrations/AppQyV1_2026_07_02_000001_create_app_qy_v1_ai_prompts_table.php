<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * AI prompt library.
 *
 * One row per reusable prompt template that the AI-prompt-request fan-out
 * (app_qy_v1_ai_prompt_requests -> AppQyV1AiPromptFanoutTask) can render and
 * dispatch as a global task. `source = 'code'` rows are owned by
 * App\Apps\AppQyV1\Utils\AppQyV1AiPromptDefaults and re-synced idempotently at
 * sys:init (never hand-edit -- next sys:init overwrites); `source = 'database'`
 * rows are operator-created/edited and never touched by the seeder.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'ai_prompts');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'prompt_key' => ['type' => 'string', 'length' => 100, 'unique' => true, 'comment' => 'Stable identifier referenced by ai_prompt_requests.prompt_keys'],
                'task_type' => ['type' => 'string', 'length' => 40, 'comment' => "Target global_tasks task_type, e.g. 'notebooklm' | 'gemini_chat'"],
                'source' => ['type' => 'string', 'length' => 16, 'default' => 'database', 'comment' => "'code' = owned by AppQyV1AiPromptDefaults, re-synced at sys:init; 'database' = operator-owned, never overwritten"],
                'title' => ['type' => 'string', 'length' => 255, 'nullable' => true],
                'prompt_template' => ['type' => 'text', 'comment' => 'Template with {source_text}/{language}/{target_language} placeholders'],
                'response_schema' => ['type' => 'json', 'nullable' => true, 'comment' => 'Documents the expected structured-reply shape (not enforced, informational)'],
                'enabled' => ['type' => 'boolean', 'default' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['prompt_key'], 'unique' => true],
                ['columns' => ['enabled']],
                ['columns' => ['source']],
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
