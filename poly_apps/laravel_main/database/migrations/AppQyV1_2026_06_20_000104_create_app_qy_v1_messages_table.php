<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social: chat messages (SOCIAL_FEATURE_SPECIFICATION.md §1).
 *
 * Append-only messages. type enum text|image|voice. The (conversation_id, id)
 * index backs the id-cursor paginated fetch. created_at only (no updated_at).
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'messages');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'conversation_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'sender_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'comment' => 'Author user id'],
                'body' => ['type' => 'text', 'nullable' => true, 'comment' => 'Message text (or caption for media)'],
                'type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'text', 'comment' => 'text|image|voice'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Media refs / extra fields'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
            ],
            'indexes' => [
                ['columns' => ['conversation_id']],
                ['columns' => ['conversation_id', 'id'], 'name' => 'idx_app_qy_v1_msg_conv_id'],
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
