<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * ding_duo_duo_v1_members.user_id — additive link from the app-specific member
 * extension row to the canonical global users table (shared credentials live
 * there; the member row keeps only app-specific membership fields).
 *
 * Idempotent via SafeMigrationHelper; re-running sys:init only ADDS the column
 * and its index. Never drops or rebuilds; existing rows stay untouched
 * (user_id starts NULL and is linked lazily at login / by the admin console).
 */
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
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => true,
                    'comment' => 'Canonical global users.id owning this member extension row',
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['user_id'],
                    'name' => 'idx_ding_members_user_id',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => false,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        // Additive-only contract: never drop columns or data.
    }
};
