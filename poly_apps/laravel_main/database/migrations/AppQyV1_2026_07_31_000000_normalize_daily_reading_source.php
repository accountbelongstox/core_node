<?php

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
