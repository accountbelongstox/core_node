<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;
    protected $tableName = 'users';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'learning_languages' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Array of language codes user is learning',
                ],
                'native_language' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => true,
                    'default' => 'zh',
                    'comment' => 'User native language code',
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
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        $connection = $this->connection ?? config('database.default');
        if (Schema::connection($connection)->hasTable($this->tableName)) {
            Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) use ($connection) {
                $columnsToRemove = [];
                if (Schema::connection($connection)->hasColumn($this->tableName, 'learning_languages')) {
                    $columnsToRemove[] = 'learning_languages';
                }
                if (Schema::connection($connection)->hasColumn($this->tableName, 'native_language')) {
                    $columnsToRemove[] = 'native_language';
                }
                if (!empty($columnsToRemove)) {
                    $table->dropColumn($columnsToRemove);
                }
            });
        }
    }
};
