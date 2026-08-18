<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social Center: live viewers (Social Center expansion §LIVE heartbeat).
 *
 * One row per (session_id, user_id) viewer. last_seen_at is bumped by the
 * viewer heartbeat; viewer_count is derived from rows fresh within a 60s window
 * (mirrors the user_presence STALE rule). UNIQUE on the pair.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'live_viewers');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'session_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'last_seen_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
            ],
            'indexes' => [
                ['columns' => ['session_id']],
                ['columns' => ['user_id']],
                ['columns' => ['last_seen_at']],
                ['columns' => ['session_id', 'user_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_live_viewer_pair'],
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
