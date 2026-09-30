<?php

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
    }

    public function up(): void
    {
        $table = (new AppQyV1ArticleModel())->getTable();
        $schema = Schema::connection($this->connection);
        $database = DB::connection($this->connection);

        if (!$schema->hasTable($table)) {
            return;
        }

        foreach ($this->indexStatements($table) as $statement) {
            $database->statement($statement);
        }
    }

    public function down(): void
    {
        $table = (new AppQyV1ArticleModel())->getTable();
        $database = DB::connection($this->connection);

        $indexNames = array_keys($this->indexNames($table));
        $indexNames[] = $table . '_meta_record_ids_gin_idx';

        foreach ($indexNames as $indexName) {
            $database->statement('DROP INDEX IF EXISTS "' . $indexName . '"');
        }
    }

    /**
     * findAgentHistoryBySourceRecordId ORs four JSON predicates; without one
     * index per predicate PostgreSQL falls back to a sequential scan of the
     * whole table on every agent-history submission (hundreds of thousands
     * of scans). The expressions below are exactly what Laravel emits, so the
     * planner can BitmapOr them.
     *
     * @return array<string, string> index name => expression
     */
    private function indexNames(string $table): array
    {
        return [
            $table . '_meta_idem_hash_idx' => "((\"metadata\"->>'idempotency_key_hash'))",
            $table . '_meta_source_record_idx' => "((\"metadata\"->>'source_record_id'))",
            $table . '_meta_idem_key_idx' => "((\"metadata\"->>'idempotency_key'))",
        ];
    }

    /**
     * @return list<string>
     */
    private function indexStatements(string $table): array
    {
        $statements = [];

        foreach ($this->indexNames($table) as $indexName => $expression) {
            $statements[] = 'CREATE INDEX IF NOT EXISTS "' . $indexName . '" ON "' . $table . '" USING btree ' . $expression;
        }

        $statements[] = 'CREATE INDEX IF NOT EXISTS "' . $table . '_meta_record_ids_gin_idx" ON "' . $table
            . '" USING gin (((("metadata"->\'source_record_ids\')::jsonb)) jsonb_path_ops)';

        return $statements;
    }
};
