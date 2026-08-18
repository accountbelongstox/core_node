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
        $this->connection = (new \App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1RechargeOrderModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'recharge_orders');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'member_id' => [
                    'type' => 'unsignedInteger',
                    'nullable' => false,
                ],
                'package_id' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => false,
                ],
                'amount' => [
                    'type' => 'decimal',
                    'precision' => 10,
                    'scale' => 2,
                    'nullable' => false,
                    'default' => 0,
                ],
                'status' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'default' => 'pending',
                ],
                'out_trade_no' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => false,
                    'unique' => true,
                ],
                'paid_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'raw' => [
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
                    'name' => 'idx_ding_recharge_orders_member',
                ],
                [
                    'columns' => ['status'],
                    'name' => 'idx_ding_recharge_orders_status',
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
