<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Row total of a table from the planner statistics (pg_class.reltuples), for
 * progress totals where an estimate is acceptable: no sequential scan. A
 * table never analyzed (reltuples < 0) is counted exactly once per cache
 * window. Cached per table for CACHE_SECONDS, independent of write versions.
 */
final class TableRowEstimate
{
    private const CACHE_PREFIX = 'table_row_estimate:';
    private const CACHE_SECONDS = 300;

    public static function rows(Model $model): int
    {
        $connection = (string) $model->getConnectionName();
        $table = $model->getTable();

        return (int) LockedCache::flexible(
            self::CACHE_PREFIX . $connection . ':' . $table,
            [self::CACHE_SECONDS, self::CACHE_SECONDS * 2],
            static function () use ($model, $connection, $table): int {
                $row = DB::connection($connection)->selectOne(
                    'SELECT reltuples::bigint AS estimate FROM pg_class WHERE oid = to_regclass(?)',
                    [$table]
                );
                $estimate = $row !== null ? (int) $row->estimate : 0;

                return $estimate >= 0 ? $estimate : $model->newQuery()->toBase()->count();
            },
            0
        );
    }

    /**
     * Uncached estimates of many tables in one pg_class read (callers cache
     * the aggregate they build); a never-analyzed table is counted exactly.
     *
     * @param array<string,string> $keyToTable
     * @return array<string,int> key => rows
     */
    public static function rowsOfTables(string $connection, array $keyToTable): array
    {
        $estimates = [];
        $rows = [];

        if ($keyToTable === []) {
            return [];
        }
        $placeholders = implode(', ', array_fill(0, count($keyToTable), 'to_regclass(?)'));
        foreach (DB::connection($connection)->select(
            'SELECT relname, reltuples::bigint AS estimate FROM pg_class WHERE oid IN (' . $placeholders . ')',
            array_values($keyToTable)
        ) as $row) {
            $estimates[(string) $row->relname] = (int) $row->estimate;
        }
        foreach ($keyToTable as $key => $table) {
            $estimate = $estimates[$table] ?? 0;
            $rows[$key] = $estimate >= 0 ? $estimate : DB::connection($connection)->table($table)->count();
        }

        return $rows;
    }

    private function __construct()
    {
    }
}
