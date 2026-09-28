<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Services\SafeMigrationHelper;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1WordGroupPublicController;
use App\Utils\StrTool;

return new class extends Migration
{
    protected $connection = 'main';
    protected $tableName = 'users';

    public function up(): void
    {
        // Add columns to users table if missing
        $tableStructure = [
            'columns' => [
                'rolelevel' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'after' => 'avatar',
                ],
                'rolename' => [
                    'type' => 'string',
                    'nullable' => false,
                    'default' => 'user',
                    'after' => 'rolelevel',
                ],
                'user_token' => [
                    'type' => 'string',
                    'nullable' => true,
                    'after' => 'password',
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
                'add_indexes' => false,
            ]
        );

        // Create admin user if not exists
        $username = 'adminroot';
        $hasAdmin = DB::table($this->tableName)->where('username', $username)->first();
        if ($hasAdmin) {
            $adminId = $hasAdmin->id;
        } else {
            $userData = [
                'nickname' => 'Administrator',
                'username' => $username,
                'rolelevel' => 100,
                'rolename' => 'Super Administrator',
                'email' => 'accountbelongstox@163.com',
                'password' => Hash::make('12345678'),
                'created_at' => now(),
                'updated_at' => now(),
                'user_token' => StrTool::genUserTokenByTimeAndUUID(),
            ];
            if (Schema::hasColumn($this->tableName, 'preferences')) {
                $userData['preferences'] = json_encode([
                    'theme' => 'dark',
                    'language' => 'en',
                    'favorites' => [],
                    'recentTools' => [],
                ]);
            }
            if (Schema::hasColumn($this->tableName, 'email_verified_at')) {
                $userData['email_verified_at'] = now();
            }
            $adminId = DB::table($this->tableName)->insertGetId($userData);
        }

        if ($adminId) {
            if (class_exists('App\Apps\DictV1\Controllers\DictV1Public\DictV1WordGroupPublicController')) {
                DictV1WordGroupPublicController::ensureDefaultGroupIfNotExist($adminId, $username);
            }
        }
    }

    public function down(): void
    {
        // Remove admin user if exists
        $username = 'adminroot';
        DB::table($this->tableName)->where('username', $username)->delete();
    }
};
