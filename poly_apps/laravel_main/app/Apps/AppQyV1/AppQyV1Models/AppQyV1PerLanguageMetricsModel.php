<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Support\Facades\DB;

/**
 * Centralized per-language aggregate executor for AppQyV1.
 *
 * AppQyV1 shards user content into ~32 per-language physical tables
 * (dictionary / sentence / article). Aggregating a metric "across all
 * languages" used to mean one COUNT round-trip (plus a hasTable /
 * information_schema introspection round-trip) PER language, which pushed
 * the assist overview/pending snapshot builds into the 300+ query range and
 * made them multi-second. This class collapses every per-language sweep into
 * a constant number of SQL round-trips:
 *
 *  - table/column existence is resolved with ONE information_schema query
 *    for the whole table set (never per-table hasTable());
 *  - counts are computed with ONE UNION ALL query that carries each
 *    language table as a single-scan branch;
 *  - multi-metric sweeps use conditional aggregates
 *    (COUNT(*) FILTER (WHERE ...) / COALESCE(SUM(...), 0)) so each branch
 *    still scans its table exactly once.
 *
 * Table names always originate from AppQyV1TableMaps / the app table-prefix
 * builder (internal, [a-z0-9_] only) and are double-quoted here; all filter
 * VALUES go through bindings. Total scan work is unchanged versus the
 * per-table loops — only the round-trip count drops — and the existing
 * queue-scan indexes (AppQyV1_2026_07_31_000001_add_queue_scan_indexes)
 * keep each branch cheap.
 */
class AppQyV1PerLanguageMetricsModel
{
    /**
     * Reduce a lang => table map to the tables that actually exist, using a
     * single information_schema round-trip instead of per-table hasTable().
     *
     * @param  array<string, string>  $langToTable
     * @return array<string, string>  lang => table (existing only)
     */
    public static function filterExistingTables(string $connection, array $langToTable): array
    {
        if ($langToTable === []) {
            return [];
        }

        $existing = array_flip(self::listTables($connection, array_values($langToTable)));

        return array_filter(
            $langToTable,
            static fn (string $table): bool => isset($existing[$table])
        );
    }

    /**
     * Column listing for a table set in ONE information_schema round-trip.
     *
     * @param  string[]  $tables
     * @return array<string, array<string, true>>  table => (column => true)
     */
    public static function columnsOfTables(string $connection, array $tables): array
    {
        if ($tables === []) {
            return [];
        }

        $quoted = implode(', ', array_map(
            static fn (string $table): string => self::quoteLiteral($table),
            $tables
        ));

        $rows = DB::connection($connection)->select(
            'SELECT table_name, column_name FROM information_schema.columns'
            . ' WHERE table_schema = current_schema() AND table_name IN (' . $quoted . ')'
        );

        $map = [];
        foreach ($rows as $row) {
            $map[$row->table_name][$row->column_name] = true;
        }

        return $map;
    }

    /**
     * Reduce a lang => table map to the tables that carry ALL of
     * $requiredColumns, using ONE information_schema round-trip.
     *
     * @param  array<string, string>  $langToTable
     * @param  string[]  $requiredColumns
     * @return array<string, string>
     */
    public static function requireColumns(string $connection, array $langToTable, array $requiredColumns): array
    {
        if ($langToTable === [] || $requiredColumns === []) {
            return $langToTable;
        }

        $columns = self::columnsOfTables($connection, array_values($langToTable));

        return self::filterTablesByColumns($langToTable, $columns, $requiredColumns);
    }

    /**
     * Pure-PHP variant of requireColumns() for callers that already fetched
     * the column map (e.g. filtering several table sets with one listing).
     *
     * @param  array<string, string>  $langToTable
     * @param  array<string, array<string, true>>  $columnsMap
     * @param  string[]  $requiredColumns
     * @return array<string, string>
     */
    public static function filterTablesByColumns(array $langToTable, array $columnsMap, array $requiredColumns): array
    {
        return array_filter($langToTable, static function (string $table) use ($columnsMap, $requiredColumns): bool {
            foreach ($requiredColumns as $column) {
                if (!isset($columnsMap[$table][$column])) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * COUNT(*) per language over per-language tables in ONE UNION ALL query.
     * Languages whose aggregate is 0 are omitted (matching the historical
     * per-table loop behavior).
     *
     * @param  array<string, string>  $langToTable  existing tables only
     * @return array<string, int>
     */
    public static function countByLanguage(
        string $connection,
        array $langToTable,
        string $whereSql,
        array $bindings = []
    ): array {
        $rows = self::metricsByLanguage(
            $connection,
            $langToTable,
            'COUNT(*) AS aggregate_value',
            $whereSql,
            $bindings
        );

        $counts = [];
        foreach ($rows as $lang => $row) {
            $count = (int) ($row['aggregate_value'] ?? 0);
            if ($count > 0) {
                $counts[$lang] = $count;
            }
        }

        return $counts;
    }

    /**
     * Multi-metric conditional aggregate per language in ONE UNION ALL query.
     *
     * $selectSql is the SELECT list placed AFTER the lang discriminator, e.g.
     *   "COUNT(*) FILTER (WHERE has_audio) AS completed, COALESCE(SUM(tts_attempts),0) AS retries"
     * The same $whereSql / $bindings are appended to every branch (use an
     * empty string when the filter is fully expressed via FILTER clauses).
     * Bindings are positional and repeat once per branch, in the given order.
     *
     * @param  array<string, string>  $langToTable  existing tables only
     * @return array<string, array<string, mixed>>  lang => assoc row
     */
    public static function metricsByLanguage(
        string $connection,
        array $langToTable,
        string $selectSql,
        string $whereSql = '',
        array $bindings = []
    ): array {
        if ($langToTable === []) {
            return [];
        }

        $branches = [];
        $allBindings = [];
        foreach ($langToTable as $lang => $table) {
            $branch = 'SELECT ' . self::quoteLiteral((string) $lang)
                . ' AS lang, ' . $selectSql
                . ' FROM "' . $table . '"';
            if ($whereSql !== '') {
                $branch .= ' WHERE ' . $whereSql;
            }
            $branches[] = $branch;
            foreach ($bindings as $binding) {
                $allBindings[] = $binding;
            }
        }

        $rows = DB::connection($connection)->select(
            implode(' UNION ALL ', $branches),
            $allBindings
        );

        $result = [];
        foreach ($rows as $row) {
            $result[(string) $row->lang] = (array) $row;
        }

        return $result;
    }

    /**
     * @param  string[]  $tables
     * @return string[]  table names that exist in the connection's schema
     */
    private static function listTables(string $connection, array $tables): array
    {
        $quoted = implode(', ', array_map(
            static fn (string $table): string => self::quoteLiteral($table),
            $tables
        ));

        $rows = DB::connection($connection)->select(
            'SELECT table_name FROM information_schema.tables'
            . ' WHERE table_schema = current_schema() AND table_name IN (' . $quoted . ')'
        );

        return array_map(static fn ($row): string => (string) $row->table_name, $rows);
    }

    private static function quoteLiteral(string $value): string
    {
        return "'" . str_replace("'", "''", $value) . "'";
    }
}
