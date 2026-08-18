<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::DINGDUODUOV1;
        $this->connection = (new \App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1DeviceModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'devices');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'device_id' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => false,
                    'unique' => true,
                ],
                'member_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => true,
                ],
                'last_seen_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'info' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['member_id'],
                    'name' => 'idx_ding_devices_member',
                ],
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
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
