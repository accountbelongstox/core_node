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

    private function __construct()
    {
    }
}
