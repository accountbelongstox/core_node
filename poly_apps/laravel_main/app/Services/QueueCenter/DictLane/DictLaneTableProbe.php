<?php

namespace App\Services\QueueCenter\DictLane;

use Illuminate\Support\Facades\DB;

/**
 * Dict-lane table probe — the ms-level DIFF signature reader.
 *
 * Compares the SOURCE TABLE's length and last-write time, never a filtered
 * aggregate, using the fastest metadata the database supports:
 *
 *   - PostgreSQL: one pg_stat_user_tables read (n_live_tup table length plus
 *     the cumulative n_tup_ins/upd/del write counters) — a stats-view lookup,
 *     no table scan.
 *   - Fallback (other drivers or stats unreadable): COUNT(*) + MAX(updated_at)
 *     on the table itself.
 *
 * The signature is per dictionary TABLE (language) and is shared by every lane
 * reading that table. A process-local dirty counter (bumped by dictionary
 * writes through DictLaneQueueCenter::noteDictionaryWrite) is folded in by the
 * caller so same-request writes are visible without waiting for the stats
 * collector.
 */
final class DictLaneTableProbe
{
    /**
     * Current signature for one table, or null when the table is unreadable
     * (missing / driver errors). Null forces the caller to treat the lane
     * cache as stale-safe (it keeps serving the last known snapshot).
     */
    public static function signature(string $connectionName, string $table): ?string
    {
        $connection = DB::connection($connectionName);

        if ($connection->getDriverName() === 'pgsql') {
            try {
                $row = $connection->selectOne(
                    'SELECT n_live_tup, n_tup_ins, n_tup_upd, n_tup_del
                       FROM pg_stat_user_tables
                      WHERE relname = ?
                        AND schemaname = ANY (current_schemas(false))',
                    [$table]
                );
                if ($row !== null) {
                    return 'pg:'
                        . (int) $row->n_live_tup . ':'
                        . (int) $row->n_tup_ins . ':'
                        . (int) $row->n_tup_upd . ':'
                        . (int) $row->n_tup_del;
                }
            } catch (\Throwable $exception) {
                // Stats view unreadable: fall through to the raw probe.
            }
        }

        try {
            $row = $connection->table($table)
                ->selectRaw('COUNT(*) AS row_count, MAX(updated_at) AS last_write')
                ->first();
            if ($row === null) {
                return null;
            }

            return 'raw:' . (int) $row->row_count . ':' . (string) ($row->last_write ?? '');
        } catch (\Throwable $exception) {
            return null;
        }
    }
}
