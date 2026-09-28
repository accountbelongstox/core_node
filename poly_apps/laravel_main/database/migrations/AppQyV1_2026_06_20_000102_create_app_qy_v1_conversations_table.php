<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social: chat conversations (SOCIAL_FEATURE_SPECIFICATION.md §1).
 *
 * A conversation is direct (1:1) or group. For direct conversations `dkey`
 * = min(uidA,uidB) . '_' . max(uidA,uidB) and is UNIQUE, so get-or-create
 * dedupes a 1:1 thread. last_message_at drives the conversation list ordering.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'conversations');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'direct', 'comment' => 'direct|group'],
                'created_by' => ['type' => 'unsignedBigInteger', 'nullable' => true, 'comment' => 'Creator user id'],
                'dkey' => ['type' => 'string', 'length' => 80, 'nullable' => true, 'unique' => true, 'comment' => 'Direct dedupe key min_max for type=direct'],
                'last_message_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true, 'comment' => 'Last message time (list ordering)'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['dkey'], 'unique' => true, 'name' => 'uniq_app_qy_v1_conv_dkey'],
                ['columns' => ['last_message_at']],
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
