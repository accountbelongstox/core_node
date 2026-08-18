<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tables;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tables = [
            AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries') => 'cover_mcp_submitted_at',
            AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books') => 'poster_mcp_submitted_at',
            AppTablePrefixServiceProvider::buildTableName($this->appKey, 'subtitles') => 'poster_mcp_submitted_at',
        ];
    }

    public function up(): void
    {
        foreach ($this->tables as $tableName => $columnName) {
            if (!Schema::connection($this->connection)->hasTable($tableName)) {
                continue;
            }
            SafeMigrationHelper::safeAddColumns($this->connection, $tableName, [
                $columnName => function (Blueprint $table, string $column) {
                    $table->timestamp($column)->nullable()
                        ->comment('Last successful resource submission from mcp-chrome');
                },
            ]);
        }
    }

    public function down(): void
    {
        // Add-only migration.
    }
};
