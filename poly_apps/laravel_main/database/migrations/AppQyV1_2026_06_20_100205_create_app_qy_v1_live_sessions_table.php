<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social Center: live sessions (Social Center expansion §LIVE).
 *
 * No native broadcast — a live is an external embed (external_url) plus SSE
 * chat. status live|ended. viewer_count is recomputed from recent live_viewers
 * heartbeats. host_id is the broadcaster.
 *
 * Idempotent via SafeMigrationHelper — add-only, never drops data.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'live_sessions');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'host_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'Broadcaster user id'],
                'title' => ['type' => 'string', 'length' => 200, 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => true],
                'status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'live', 'index' => true, 'comment' => 'live|ended'],
                'external_url' => ['type' => 'string', 'length' => 500, 'nullable' => true, 'comment' => 'External embed/stream url'],
                'viewer_count' => ['type' => 'unsignedInteger', 'nullable' => false, 'default' => 0],
                'started_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'ended_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['host_id']],
                ['columns' => ['status']],
                ['columns' => ['started_at']],
                ['columns' => ['status', 'started_at'], 'name' => 'idx_app_qy_v1_live_status_started'],
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
