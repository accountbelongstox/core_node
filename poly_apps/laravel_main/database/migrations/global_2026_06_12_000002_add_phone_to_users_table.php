<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

/**
 * Add the `phone` column to the main users table.
 *
 * CommonAuthService::authenticateUser() and AppQyV1's SMS login both query the
 * users table by username OR email OR phone, but the original create-users
 * migration never defined `phone`. On the legacy SQLite database the column had
 * been added ad-hoc, so the gap stayed hidden; on a fresh per-app PostgreSQL
 * database the missing column makes every username/email login throw
 * "column \"phone\" does not exist" (SQLSTATE 42703). This idempotent migration
 * adds it so the shared auth service (which must not be modified) works on PG.
 */
return new class extends Migration
{
    protected $connection = null;
    protected $tableName = 'users';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'phone' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => true,
                    'comment' => 'User phone number (login identifier; nullable)',
                ],
            ],
            'indexes' => [
                ['columns' => ['phone']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
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
        $connection = $this->connection ?? config('database.default');
        if (Schema::connection($connection)->hasTable($this->tableName)) {
            if (Schema::connection($connection)->hasColumn($this->tableName, 'phone')) {
                Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropColumn('phone');
                });
            }
        }
    }
};
