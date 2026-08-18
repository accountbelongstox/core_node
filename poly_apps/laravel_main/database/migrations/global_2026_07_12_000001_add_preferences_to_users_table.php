<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

/**
 * users.preferences — JSON blob for per-user dashboard / manager settings
 * (theme, language, favorites, recentTools, daily_goal, app_settings.reader, …).
 * Idempotent via SafeMigrationHelper; re-running sys:init only ADDS the column.
 */
return new class extends Migration
{
    protected $connection = null;
    protected $tableName = 'users';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'preferences' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Per-user preferences JSON (theme, language, favorites, manager settings)',
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => false,
            ]
        );
    }

    public function down(): void
    {
        $connection = $this->connection ?? config('database.default');
        if (Schema::connection($connection)->hasTable($this->tableName)
            && Schema::connection($connection)->hasColumn($this->tableName, 'preferences')) {
            Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->dropColumn('preferences');
            });
        }
    }
};
