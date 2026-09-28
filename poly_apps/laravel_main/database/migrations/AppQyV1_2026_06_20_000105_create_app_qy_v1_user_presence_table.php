<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social: user presence (SOCIAL_FEATURE_SPECIFICATION.md §1/§4).
 *
 * Heartbeat-written online status. status enum online|away|studying|offline.
 * UNIQUE(user_id) — one row per user, upserted on heartbeat. On READ, a
 * last_seen_at older than 60s is treated as effectively offline. Replaces the
 * non-existent users.is_online / last_seen_at the old presence read relied on.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_presence');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'unique' => true, 'comment' => 'One presence row per user'],
                'status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'offline', 'index' => true, 'comment' => 'online|away|studying|offline'],
                'last_seen_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true, 'comment' => 'Last heartbeat time; >60s old reads as offline'],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_user_presence_user'],
                ['columns' => ['status']],
                ['columns' => ['last_seen_at']],
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
