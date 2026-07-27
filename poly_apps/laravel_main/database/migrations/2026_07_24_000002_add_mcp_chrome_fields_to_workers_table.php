<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $tableName = 'workers';
        if (!Schema::connection($this->connection ?? config('database.default'))->hasTable($tableName)) {
            return;
        }

        SafeMigrationHelper::safeAddColumns(
            $this->connection ?? config('database.default'),
            $tableName,
            [
                'mcp_chrome_last_attempt_at' => function (Blueprint $table, string $column) {
                    $table->timestamp($column)->nullable()->comment('Last attempt time for MCP Chrome worker');
                },
                'last_marker' => function (Blueprint $table, string $column) {
                    $table->string($column)->nullable()->comment('Last marker for MCP Chrome worker');
                },
            ]
        );
    }

    public function down(): void
    {
        // Add-only migration
    }
};
