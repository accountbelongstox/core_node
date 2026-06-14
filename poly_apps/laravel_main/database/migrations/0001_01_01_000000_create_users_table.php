<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $this->createUsersTable();
        $this->createPasswordResetTokensTable();
        $this->createSessionsTable();
    }

    private function createUsersTable(): void
    {
        $tableName = 'users';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'name' => ['type' => 'string', 'nullable' => true],
                'nickname' => ['type' => 'string', 'nullable' => true],
                'username' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                // Login identifier alongside username/email (queried by the shared
                // CommonAuthService and AppQyV1 SMS login). Kept in sync with
                // global_2026_06_12_000002_add_phone_to_users_table for existing DBs.
                'phone' => ['type' => 'string', 'length' => 32, 'nullable' => true],
                'avatar' => ['type' => 'string', 'nullable' => true],
                'about' => ['type' => 'text', 'nullable' => true],
                'flollwers' => ['type' => 'string', 'nullable' => true],
                'website' => ['type' => 'string', 'nullable' => true],
                'github' => ['type' => 'string', 'nullable' => true],
                'wechat' => ['type' => 'string', 'nullable' => true],
                'weibo' => ['type' => 'string', 'nullable' => true],
                'qq' => ['type' => 'string', 'nullable' => true],
                'age' => ['type' => 'string', 'nullable' => true],
                'gender' => ['type' => 'string', 'nullable' => true],
                'birthday' => ['type' => 'string', 'nullable' => true],
                'city' => ['type' => 'string', 'nullable' => true],
                'education' => ['type' => 'string', 'nullable' => true],
                'occupation' => ['type' => 'string', 'nullable' => true],
                'language' => ['type' => 'string', 'nullable' => true],
                'religion' => ['type' => 'string', 'nullable' => true],
                'rolelevel' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'rolename' => ['type' => 'string', 'nullable' => false, 'default' => 'user'],
                'email' => ['type' => 'string', 'nullable' => true],
                'email_verified_at' => ['type' => 'timestamp', 'nullable' => true],
                'password' => ['type' => 'string', 'nullable' => false],
                'user_token' => ['type' => 'string', 'nullable' => true],
                'remember_token' => ['type' => 'string', 'length' => 100, 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['username']],
                ['columns' => ['email']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createPasswordResetTokensTable(): void
    {
        $tableName = 'password_reset_tokens';
        $tableStructure = [
            'columns' => [
                'email' => ['type' => 'string', 'nullable' => false],
                'token' => ['type' => 'string', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['email'], 'unique' => true],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createSessionsTable(): void
    {
        $tableName = 'sessions';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'string', 'nullable' => false],
                'user_id' => ['type' => 'foreignId', 'nullable' => true],
                'ip_address' => ['type' => 'string', 'length' => 45, 'nullable' => true],
                'user_agent' => ['type' => 'text', 'nullable' => true],
                'payload' => ['type' => 'longText', 'nullable' => false],
                'last_activity' => ['type' => 'integer', 'nullable' => false],
            ],
            'indexes' => [
                ['columns' => ['id'], 'unique' => true],
                ['columns' => ['user_id']],
                ['columns' => ['last_activity']],
            ],
            'foreignKeys' => [
                [
                    'column' => 'user_id',
                    'references' => 'users',
                    'on' => 'id',
                    'onDelete' => 'cascade',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $tableName,
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
        $connection = $this->connection ?? config('database.default');
        Schema::connection($connection)->dropIfExists('sessions');
        Schema::connection($connection)->dropIfExists('password_reset_tokens');
        Schema::connection($connection)->dropIfExists('users');
    }
};
