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
        $this->connection = (new \App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1MemberModel)->getConnectionName();
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'members');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'increments',
                ],
                'username' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => false,
                    'unique' => true,
                ],
                'password' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => false,
                ],
                'token' => [
                    'type' => 'string',
                    'length' => 191,
                    'nullable' => true,
                    'unique' => true,
                ],
                'tier' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => false,
                    'default' => 'free',
                ],
                'max_binds' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 1,
                ],
                'balance' => [
                    'type' => 'decimal',
                    'precision' => 10,
                    'scale' => 2,
                    'nullable' => false,
                    'default' => 0,
                ],
                'permissions' => [
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
                'remark' => [
                    'type' => 'string',
                    'length' => 255,
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
                    'columns' => ['tier'],
                    'name' => 'idx_ding_members_tier',
                ],
                [
                    'columns' => ['status'],
                    'name' => 'idx_ding_members_status',
                ],
                [
                    'columns' => ['expires_at'],
                    'name' => 'idx_ding_members_expires_at',
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
