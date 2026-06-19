<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

/**
 * AppQyV1 sub-app extends the shared main `users` table. The profile editor
 * (AppQyV1ProfileController) reads/writes `bio` (personal intro) and `location`,
 * but those columns did not exist on the main table. Add them IDEMPOTENTLY via
 * SafeMigrationHelper (aligns structure — no-op when the columns already exist),
 * matching the learning_languages/native_language extension pattern.
 */
return new class extends Migration
{
    protected $connection = null;
    protected $tableName = 'users';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'bio' => [
                    'type' => 'text',
                    'nullable' => true,
                    'comment' => 'User personal introduction / bio',
                ],
                'location' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                    'comment' => 'User location',
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
        if (Schema::connection($connection)->hasTable($this->tableName)) {
            Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) use ($connection) {
                $columnsToRemove = [];
                if (Schema::connection($connection)->hasColumn($this->tableName, 'bio')) {
                    $columnsToRemove[] = 'bio';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'location')) {
                    $columnsToRemove[] = 'location';
                }
                if (!empty($columnsToRemove)) {
                    $table->dropColumn($columnsToRemove);
                }
            });
        }
    }
};
