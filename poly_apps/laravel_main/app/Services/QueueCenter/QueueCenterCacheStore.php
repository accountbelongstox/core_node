<?php

namespace App\Services\QueueCenter;

use Illuminate\Cache\Repository;
use Illuminate\Support\Facades\Cache;

/**
 * Queue Center counter/state store on the database cache driver (PostgreSQL).
 *
 * The hot path (slice revisions bumped on every create / claim / terminal
 * receipt, read by the 1s diff poll) must never take a lock-block: the
 * database store's increment is one row-locked atomic statement and add() is
 * an atomic insert-or-ignore, so counters stay correct without the 5s
 * lock-block the previous file-store implementation serialized on.
 */
final class QueueCenterCacheStore
{
    private const STORE = 'database';

    public static function get(): Repository
    {
        return Cache::store(self::STORE);
    }

    public static function increment(string $key, int $minimum = 0): int
    {
        $cache = self::get();
        $value = $cache->increment($key);
        if ($value !== false) {
            return (int) $value;
        }

        // First transition: seed atomically, then bump. Concurrent first
        // bumps converge on the single inserted row.
        $cache->add($key, $minimum);
        $value = $cache->increment($key);

        return $value !== false ? (int) $value : $minimum + 1;
    }

    public static function initialize(string $key, int $minimum): int
    {
        $cache = self::get();
        $cache->add($key, $minimum);

        return max($minimum, (int) $cache->get($key, $minimum));
    }
}
