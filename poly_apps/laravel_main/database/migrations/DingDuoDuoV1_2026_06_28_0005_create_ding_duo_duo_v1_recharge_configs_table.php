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
        $this->connection = (new \App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1RechargeConfigModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'recharge_configs');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'provider' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'default' => 'custom',
                ],
                'api_key' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                ],
                'api_secret' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                ],
                'endpoint' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                ],
                'notify_url' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                ],
                'packages' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'enabled' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
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
                    'columns' => ['enabled'],
                    'name' => 'idx_ding_recharge_configs_enabled',
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
