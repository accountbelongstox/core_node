<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Translation real-time event outbox.
 *
 * Append-only transactional outbox for translation queue events. A dedicated
 * Octane task publishes committed rows through Mercure, while retained rows
 * provide bounded cursor replay after a client reconnects.
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
                'published_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true, 'comment' => 'Successful Mercure publication time'],
                'publish_after' => ['type' => 'timestamp', 'nullable' => true, 'index' => true, 'comment' => 'Earliest retry time after a publication failure'],
                'publish_attempts' => ['type' => 'unsignedInteger', 'default' => 0, 'comment' => 'Bounded publisher attempt count'],
                'last_publish_error' => ['type' => 'text', 'nullable' => true, 'comment' => 'Latest Mercure publication failure'],
            ],
            'indexes' => [
                ['columns' => ['event']],
                ['columns' => ['created_at']],
                ['columns' => ['published_at', 'publish_after', 'id'], 'name' => 'idx_app_qy_v1_translation_evt_publish_v2'],
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
