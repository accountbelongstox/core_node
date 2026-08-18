<?php

namespace App\Services\DataSync;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

final class DataSyncTopologyGuard
{
    private const LOCK_KEY = 'data-sync:topology';
    private const LOCK_SECONDS = 15;

    public function run(callable $callback): mixed
    {
        try {
            return Cache::store('file')->withoutOverlapping(
                self::LOCK_KEY,
                $callback,
                lockFor: self::LOCK_SECONDS,
                waitFor: 0
            );
        } catch (LockTimeoutException) {
            throw new \RuntimeException('Another synchronization topology request is already being processed.');
        }
    }
}
