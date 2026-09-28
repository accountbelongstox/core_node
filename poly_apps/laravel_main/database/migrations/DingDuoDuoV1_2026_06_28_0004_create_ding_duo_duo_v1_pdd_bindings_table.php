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
        $this->connection = (new \App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1PddBindingModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'pdd_bindings');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'owner_type' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                ],
                'owner_id' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => false,
                ],
                'pdd_user_id' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => false,
                ],
                'nickname' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => true,
                ],
                'status' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'default' => 'active',
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
                    'columns' => ['owner_type', 'owner_id', 'pdd_user_id'],
                    'name' => 'uniq_ding_bindings_owner_pdd',
                    'unique' => true,
                ],
                [
                    'columns' => ['owner_type', 'owner_id'],
                    'name' => 'idx_ding_bindings_owner',
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
