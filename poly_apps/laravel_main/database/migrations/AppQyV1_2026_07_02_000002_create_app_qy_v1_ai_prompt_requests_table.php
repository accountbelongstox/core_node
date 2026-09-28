<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * AI prompt request inbox.
 *
 * The single passive submission point for prompt-driven AI processing: any
 * caller inserts one row here (source_text + optional prompt_keys), and
 * AppQyV1AiPromptFanoutTask (app/Services/TimerTasks) picks up pending rows on
 * its own schedule and fans each one out into one global_tasks row PER matching
 * prompt (app_qy_v1_ai_prompts). No direct caller-to-worker coupling: submitting
 * a row here is the entire contract.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'ai_prompt_requests');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_text' => ['type' => 'text', 'comment' => 'Passage / words / sentences to process'],
                'language' => ['type' => 'string', 'length' => 16, 'nullable' => true],
                'target_language' => ['type' => 'string', 'length' => 16, 'nullable' => true],
                'prompt_keys' => ['type' => 'json', 'nullable' => true, 'comment' => 'Explicit app_qy_v1_ai_prompts.prompt_key list; null/empty = every enabled prompt'],
                'status' => ['type' => 'string', 'length' => 16, 'default' => 'pending', 'comment' => 'pending|processed|failed'],
                'requested_by' => ['type' => 'string', 'length' => 100, 'nullable' => true, 'comment' => 'Free-form origin tag for diagnostics, e.g. feature/page name'],
                'processed_at' => ['type' => 'timestamp', 'nullable' => true],
                'error' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['status', 'created_at'], 'name' => 'idx_ai_prompt_requests_scan'],
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
