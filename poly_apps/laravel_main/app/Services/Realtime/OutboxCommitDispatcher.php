<?php

namespace App\Services\Realtime;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class OutboxCommitDispatcher
{
    /**
     * Run $callback after the surrounding transaction commits. When
     * $connectionName is given, the callback binds to THAT connection's
     * afterCommit (afterCommit is registered per connection; a callback bound
     * to another open connection would fire on the wrong commit). Without a
     * connection name the first connection inside a transaction is used.
     */
    public static function dispatch(callable $callback, ?string $connectionName = null): void
    {
        if ($connectionName !== null) {
            $connection = DB::connection($connectionName);
            if ($connection instanceof ConnectionInterface && $connection->transactionLevel() > 0) {
                $connection->afterCommit($callback);
                return;
            }

            $callback();
            return;
        }

        $connections = DB::getConnections();

        foreach ($connections as $connection) {
            if (!$connection instanceof ConnectionInterface || $connection->transactionLevel() <= 0) {
                continue;
            }

            $connection->afterCommit($callback);
            return;
        }

        $callback();
    }
}
