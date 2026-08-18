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
        $this->connection = (new \App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1SuperCodeModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'super_codes');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'code' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => false,
                    'unique' => true,
                ],
                'label' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => true,
                ],
                'tier' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'default' => 'unlimited',
                ],
                'max_binds' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                ],
                'features' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'scope' => [
                    'type' => 'json',
                    'nullable' => true,
                ],
                'expires_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'status' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'default' => 'active',
                ],
                'created_by' => [
                    'type' => 'string',
                    'length' => 191,
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
                    'columns' => ['status'],
                    'name' => 'idx_ding_super_codes_status',
                ],
                [
                    'columns' => ['tier'],
                    'name' => 'idx_ding_super_codes_tier',
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
