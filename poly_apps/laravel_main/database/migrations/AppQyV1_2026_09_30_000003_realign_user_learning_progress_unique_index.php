<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    protected $connection;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
    }

    public function up(): void
    {
        // Indexes declared unique but stored as plain btrees under a
        // "unique*" name make every ON CONFLICT upsert fail with SQLSTATE
        // 42P10 (user_learning_progress, user_selected_libraries,
        // group_libraries, user_follows, group_word_progress at the time of
        // writing). The drift is read from the catalog and each index is
        // rebuilt as UNIQUE with the same name and columns. No rows are ever
        // deleted: an index whose key already holds duplicates is skipped and
        // logged for a manual decision.
        $database = DB::connection($this->connection);

        foreach ($this->driftedIndexes($database) as $index) {
            $table = $this->quote($index->tbl);
            $columnList = implode(', ', array_map(fn (string $column): string => $this->quote($column), explode(',', $index->cols)));

            $duplicates = $database->selectOne(
                "SELECT count(*) AS c FROM (SELECT 1 FROM {$table} GROUP BY {$columnList} HAVING count(*) > 1) d"
            );
            if ((int) ($duplicates->c ?? 0) > 0) {
                Log::warning('Unique index realign skipped: duplicate keys present', [
                    'table' => $index->tbl,
                    'index' => $index->idx,
                    'duplicate_groups' => (int) $duplicates->c,
                ]);
                continue;
            }

            $database->statement('DROP INDEX IF EXISTS ' . $this->quote($index->idx));
            $database->statement('CREATE UNIQUE INDEX ' . $this->quote($index->idx) . " ON {$table} ({$columnList})");
        }
    }

    public function down(): void
    {
    }

    private function driftedIndexes($database): array
    {
        return $database->select(
            "SELECT t.relname AS tbl, i.relname AS idx, "
            . "string_agg(a.attname, ',' ORDER BY k.ord) AS cols "
            . "FROM pg_index x "
            . "JOIN pg_class i ON i.oid = x.indexrelid "
            . "JOIN pg_class t ON t.oid = x.indrelid "
            . "JOIN pg_namespace n ON n.oid = t.relnamespace "
            . "CROSS JOIN LATERAL unnest(x.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord) "
            . "JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum "
            . "WHERE n.nspname = 'public' AND NOT x.indisunique AND x.indpred IS NULL AND x.indexprs IS NULL "
            . "AND i.relname ILIKE 'unique%' AND t.relkind = 'r' "
            . "GROUP BY t.oid, t.relname, i.relname"
        );
    }

    private function quote(string $identifier): string
    {
        return '"' . str_replace('"', '""', $identifier) . '"';
    }
};
