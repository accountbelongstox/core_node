<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social: notifications (SOCIAL_FEATURE_SPECIFICATION.md §1).
 *
 * Per-user notification inbox (friend_request, friend_accept, new_message, ...).
 * read_at null = unread. (user_id, id) backs the cursor list; (user_id, read_at)
 * backs the unread-count query.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'notifications');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'Recipient user id'],
                'type' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'comment' => 'friend_request|friend_accept|new_message|...'],
                'payload' => ['type' => 'json', 'nullable' => true, 'comment' => 'Type-specific data'],
                'read_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true, 'comment' => 'null = unread'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['user_id', 'id'], 'name' => 'idx_app_qy_v1_notif_user_id'],
                ['columns' => ['user_id', 'read_at'], 'name' => 'idx_app_qy_v1_notif_user_read'],
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
