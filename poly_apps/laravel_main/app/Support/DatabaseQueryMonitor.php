<?php

namespace App\Support;

use Illuminate\Database\Connection;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class DatabaseQueryMonitor
{
    private const CUMULATIVE_QUERY_THRESHOLD_MS = 500;

    public static function register(): void
    {
        $connections = config('database.connections', []);

        foreach ($connections as $name => $configuration) {
            if (($configuration['driver'] ?? null) !== 'pgsql') {
                continue;
            }

            DB::connection($name)->whenQueryingForLongerThan(
                self::CUMULATIVE_QUERY_THRESHOLD_MS,
                static function (Connection $connection, QueryExecuted $event): void {
                    Log::warning('[DatabaseQueryMonitor] Cumulative query time threshold exceeded', [
                        'connection' => $connection->getName(),
                        'database' => $connection->getDatabaseName(),
                        'total_ms' => round($connection->totalQueryDuration(), 2),
                        'last_query_ms' => $event->time,
                        'sql' => $event->sql,
                    ]);
                }
            );
        }
    }
}
