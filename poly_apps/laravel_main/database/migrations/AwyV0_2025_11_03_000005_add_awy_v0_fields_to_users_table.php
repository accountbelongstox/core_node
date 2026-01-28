<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'sqlite';
    protected $tableName = 'users';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'bio' => [
                    'type' => 'string',
                    'nullable' => true,
                ],
                'location' => [
                    'type' => 'string',
                    'nullable' => true,
                ],
                'avatar' => [
                    'type' => 'string',
                    'nullable' => true,
                ],
                'last_login_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'phone_verified_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'email_verified_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'password_reset_token' => [
                    'type' => 'string',
                    'nullable' => true,
                ],
                'password_reset_expires_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'status' => [
                    'type' => 'string',
                    'nullable' => false,
                    'default' => 'active',
                ],
                'is_online' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => false,
                ],
                'last_seen_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                ['columns' => ['status'], 'name' => 'users_status'],
                ['columns' => ['is_online'], 'name' => 'users_online'],
                ['columns' => ['last_seen_at'], 'name' => 'users_last_seen'],
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
        $connection = $this->connection;
        if (Schema::connection($connection)->hasTable($this->tableName)) {
            try {
                Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropIndex('users_status');
                });
            } catch (\Exception $e) {
            }

            try {
                Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropIndex('users_online');
                });
            } catch (\Exception $e) {
            }

            try {
                Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropIndex('users_last_seen');
                });
            } catch (\Exception $e) {
            }

            Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $columnsToRemove = [];
                if (Schema::connection($connection)->hasColumn($this->tableName, 'bio')) {
                    $columnsToRemove[] = 'bio';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'location')) {
                    $columnsToRemove[] = 'location';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'avatar')) {
                    $columnsToRemove[] = 'avatar';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'last_login_at')) {
                    $columnsToRemove[] = 'last_login_at';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'phone_verified_at')) {
                    $columnsToRemove[] = 'phone_verified_at';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'email_verified_at')) {
                    $columnsToRemove[] = 'email_verified_at';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'password_reset_token')) {
                    $columnsToRemove[] = 'password_reset_token';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'password_reset_expires_at')) {
                    $columnsToRemove[] = 'password_reset_expires_at';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'status')) {
                    $columnsToRemove[] = 'status';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'is_online')) {
                    $columnsToRemove[] = 'is_online';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'last_seen_at')) {
                    $columnsToRemove[] = 'last_seen_at';
                }

                if (!empty($columnsToRemove)) {
                    $table->dropColumn($columnsToRemove);
                }
            });
        }
    }
};
