<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social Center: live chat messages (Social Center expansion §LIVE chat).
 *
 * Append-only chat log per live session. Polled by the FE (cursor by id) and
 * mirrored to current viewers/host via the social_events SSE outbox.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'live_messages');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'session_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'body' => ['type' => 'text', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
            ],
            'indexes' => [
                ['columns' => ['session_id']],
                ['columns' => ['user_id']],
                ['columns' => ['created_at']],
                ['columns' => ['session_id', 'id'], 'name' => 'idx_app_qy_v1_live_msg_session_id'],
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
