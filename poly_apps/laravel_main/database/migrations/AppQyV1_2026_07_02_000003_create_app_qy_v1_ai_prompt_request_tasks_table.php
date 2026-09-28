<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * AI prompt request fan-out ledger.
 *
 * One row per (ai_prompt_request, prompt) pair AppQyV1AiPromptFanoutTask is
 * handling or has already turned into a global_tasks row. The unique
 * (request_id, prompt_key) constraint is the ONLY real dedup guard: the fan-out
 * task INSERTS this reservation row (task_id NULL) BEFORE creating the
 * global_tasks row, so two overlapping ticks racing on the same pair can never
 * both create a global_tasks row — the losing insert fails the unique
 * constraint and is treated as "already handled", not retried as a duplicate.
 * task_id is filled in once the global_tasks row exists; a row that never gets
 * its task_id filled (creation failed after reservation) is deleted so a later
 * tick can retry cleanly instead of being permanently blocked.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'ai_prompt_request_tasks');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'request_id' => ['type' => 'unsignedBigInteger', 'index' => true],
                'prompt_key' => ['type' => 'string', 'length' => 100],
                'task_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'index' => true, 'comment' => 'global_tasks.task_id created for this pair; NULL = reserved but not yet created'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['request_id', 'prompt_key'], 'unique' => true, 'name' => 'uniq_ai_prompt_request_task'],
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
