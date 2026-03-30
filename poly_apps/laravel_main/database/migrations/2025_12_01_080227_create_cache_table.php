<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $this->createCacheTable();
        $this->createCacheLocksTable();
    }

    private function createCacheTable(): void
    {
        $tableName = 'cache';
        $tableStructure = [
            'columns' => [
                'key' => ['type' => 'string', 'nullable' => false],
                'value' => ['type' => 'mediumText', 'nullable' => false],
                'expiration' => ['type' => 'integer', 'nullable' => false],
            ],
            'indexes' => [
                ['columns' => ['key'], 'unique' => true],
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

        $connectionName = $this->connection ?? config('database.default');
        $db = DB::connection($connectionName);
        $db->statement('DROP INDEX IF EXISTS cache_key_index');
        $db->statement('CREATE UNIQUE INDEX IF NOT EXISTS cache_key_unique ON cache(key)');
    }

    private function createCacheLocksTable(): void
    {
        $tableName = 'cache_locks';
        $tableStructure = [
            'columns' => [
                'key' => ['type' => 'string', 'nullable' => false],
                'owner' => ['type' => 'string', 'nullable' => false],
                'expiration' => ['type' => 'integer', 'nullable' => false],
            ],
            'indexes' => [
                ['columns' => ['key'], 'unique' => true],
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

        $connectionName = $this->connection ?? config('database.default');
        $db = DB::connection($connectionName);
        $db->statement('DROP INDEX IF EXISTS cache_locks_key_index');
        $db->statement('CREATE UNIQUE INDEX IF NOT EXISTS cache_locks_key_unique ON cache_locks(key)');
    }

    public function down(): void
    {
        $connection = $this->connection ?? config('database.default');
        Schema::connection($connection)->dropIfExists('cache_locks');
        Schema::connection($connection)->dropIfExists('cache');
    }
};
