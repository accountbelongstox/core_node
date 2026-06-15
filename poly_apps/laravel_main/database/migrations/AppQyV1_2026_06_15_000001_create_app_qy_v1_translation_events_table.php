<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Translation real-time event outbox.
 *
 * Append-only bus that replaces Laravel Reverb for the translation pipeline.
 * Every translation-queue event (task.queued / task.priority / word.translated /
 * task.completed) is mirrored here by a single listener in AppServiceProvider,
 * and the SSE endpoint
 * (GET /api/app_qy_v1/ai_tools/translation/queue/stream) streams rows with
 * id > cursor to pycore over the same Octane :9000 HTTP port — no separate
 * Reverb/WebSocket process. Rows are pruned by age from the stream loop.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'translation_events');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'event' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'index' => true, 'comment' => 'Dotted contract name: task.queued|task.priority|word.translated|task.completed'],
                'data' => ['type' => 'text', 'nullable' => true, 'comment' => 'JSON payload (broadcastWith of the originating event)'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true, 'comment' => 'Emit time; drives age-based pruning'],
            ],
            'indexes' => [
                ['columns' => ['event']],
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
