<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social: friend requests (SOCIAL_FEATURE_SPECIFICATION.md §1).
 *
 * Two-way friendship requests, kept ALONGSIDE the existing one-way
 * user_follows. status enum pending|accepted|rejected|blocked. UNIQUE on
 * (requester_id, addressee_id) so a pair has at most one request row.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'friend_requests');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'requester_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'User who sent the request'],
                'addressee_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'User who received the request'],
                // String (not DB enum) keeps pgsql/sqlite symmetric.
                'status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'pending', 'index' => true, 'comment' => 'pending|accepted|rejected|blocked'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['requester_id']],
                ['columns' => ['addressee_id']],
                ['columns' => ['status']],
                ['columns' => ['requester_id', 'addressee_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_friend_req_pair'],
                ['columns' => ['addressee_id', 'status'], 'name' => 'idx_app_qy_v1_friend_req_addr_status'],
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
