<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CacheDatabasePruneExpiredCommand extends Command
{
    protected $signature = 'cache:prune-database-expired {--batch=5000 : Rows deleted per statement}';

    protected $description = 'Delete expired rows from the database cache and cache lock tables';

    public function handle(): int
    {
        $store = (array) config('cache.stores.database');
        $connection = DB::connection($store['connection'] ?? null);
        $batch = max(100, (int) $this->option('batch'));
        $now = time();
        $tables = array_filter([
            (string) ($store['table'] ?? ''),
            (string) ($store['lock_table'] ?? ''),
        ]);
        $deletedTotal = 0;

        foreach ($tables as $table) {
            do {
                $ids = $connection->table($table)
                    ->where('expiration', '<', $now)
                    ->limit($batch)
                    ->pluck('key')
                    ->all();
                $deleted = $ids === [] ? 0 : $connection->table($table)
                    ->whereIn('key', $ids)
                    ->where('expiration', '<', $now)
                    ->delete();
                $deletedTotal += $deleted;
            } while ($deleted >= $batch);
        }

        $this->info("Pruned {$deletedTotal} expired cache rows");

        return 0;
    }
}
