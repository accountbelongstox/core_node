<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Cache::flexible with a non-blocking single-flight cold fill (the
 * serveSnapshot pattern). A warm key is served by Cache::flexible (its stale
 * refresh is already deferred and locked). On a cold key only the fill-lock
 * winner computes; every other caller returns at once with the last good
 * value (written by every fill, kept LAST_GOOD_SECONDS past the stale
 * window), else the caller's degraded default. No request worker ever waits
 * on another's fill.
 */
final class LockedCache
{
    private const LOCK_PREFIX = 'locked_cache:fill:';
    private const LAST_GOOD_SUFFIX = ':last_good';
    private const LOCK_SECONDS = 30;
    private const LAST_GOOD_SECONDS = 86400;

    /**
     * @param array{0:int,1:int} $ttl [fresh seconds, stale seconds]
     * @param mixed $degraded value (or Closure giving it) served while another caller fills a cold key with no last good value
     */
    public static function flexible(string $key, array $ttl, Closure $callback, mixed $degraded = null): mixed
    {
        $lock = null;
        $lastGood = null;
        $fill = static function () use ($key, $ttl, $callback): mixed {
            $value = $callback();
            Cache::put($key . self::LAST_GOOD_SUFFIX, ['value' => $value], (int) $ttl[1] + self::LAST_GOOD_SECONDS);

            return $value;
        };

        if (Cache::has($key)) {
            return Cache::flexible($key, $ttl, $fill);
        }
        $lock = Cache::lock(self::LOCK_PREFIX . $key, self::LOCK_SECONDS);
        if (!$lock->get()) {
            $lastGood = Cache::get($key . self::LAST_GOOD_SUFFIX);
            if (is_array($lastGood) && array_key_exists('value', $lastGood)) {
                return $lastGood['value'];
            }

            return $degraded instanceof Closure ? $degraded() : $degraded;
        }
        try {
            return Cache::flexible($key, $ttl, $fill);
        } finally {
            $lock->release();
        }
    }

    private function __construct()
    {
    }
}
