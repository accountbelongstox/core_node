<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Per-user manifest of client-side orchestration tasks. The device is
 * authoritative; rows merge by client_updated_at and deleted_at is the
 * tombstone other devices learn deletions from.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'orch_client_tasks');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'bigInteger', 'nullable' => false, 'index' => true],
                'client_task_id' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'name' => ['type' => 'string', 'length' => 255, 'nullable' => true],
                'source' => ['type' => 'string', 'length' => 32, 'nullable' => false],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true],
                'source_ref' => ['type' => 'json', 'nullable' => true],
                'config' => ['type' => 'json', 'nullable' => true],
                'plan_hash' => ['type' => 'string', 'length' => 128, 'nullable' => true],
                'status' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'default' => 'draft'],
                'segment_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'item_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'duration_ms' => ['type' => 'bigInteger', 'nullable' => false, 'default' => 0],
                'device_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
                'client_updated_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'deleted_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id', 'client_task_id'], 'unique' => true, 'name' => 'uniq_orch_client_task_user_id'],
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
