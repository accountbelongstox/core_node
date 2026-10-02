<?php

namespace App\Support;

use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * Cache::flexible with a stampede lock on the cold fill. A warm key is served
 * by Cache::flexible (its stale refresh is already deferred and locked); a
 * cold key is computed by one request while concurrent requests wait for it.
 */
final class LockedCache
{
    private const LOCK_PREFIX = 'locked_cache:fill:';
    private const LOCK_SECONDS = 30;
    private const WAIT_SECONDS = 10;

    /** @param array{0:int,1:int} $ttl [fresh seconds, stale seconds] */
    public static function flexible(string $key, array $ttl, Closure $callback): mixed
    {
        if (Cache::has($key)) {
            return Cache::flexible($key, $ttl, $callback);
        }
        try {
            return Cache::lock(self::LOCK_PREFIX . $key, self::LOCK_SECONDS)
                ->block(self::WAIT_SECONDS, static fn () => Cache::flexible($key, $ttl, $callback));
        } catch (LockTimeoutException) {
            // The holder is still computing after WAIT_SECONDS: serve this
            // request directly rather than fail it.
            return $callback();
        }
    }

    private function __construct()
    {
    }
}
