<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social: conversation participants (SOCIAL_FEATURE_SPECIFICATION.md §1).
 *
 * Membership of a conversation. UNIQUE(conversation_id, user_id). The
 * caller's participation row is the authorization check for every message
 * endpoint. last_read_message_id drives unread counts.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversation_participants');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'conversation_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'last_read_message_id' => ['type' => 'unsignedBigInteger', 'nullable' => true, 'comment' => 'Highest message id this participant has read'],
                'joined_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['conversation_id']],
                ['columns' => ['user_id']],
                ['columns' => ['conversation_id', 'user_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_conv_participant'],
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
