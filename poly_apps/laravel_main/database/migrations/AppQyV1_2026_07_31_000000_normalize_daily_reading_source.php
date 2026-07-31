<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;
    protected $tableName;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'articles');
    }

    public function up(): void
    {
        if (!Schema::connection($this->connection)->hasTable($this->tableName)) {
            return;
        }

        DB::connection($this->connection)
            ->table($this->tableName)
            ->where('source', 'agent_history')
            ->update([
                'source' => 'daily',
                'article_type' => 'daily',
                'is_daily_reading' => true,
            ]);
    }

    public function down(): void
    {
        // Canonical source normalization is intentionally irreversible.
    }
};
