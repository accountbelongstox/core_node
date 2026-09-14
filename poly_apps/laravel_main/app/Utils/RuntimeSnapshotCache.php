<?php

namespace App\Utils;

use Illuminate\Support\Facades\Cache;

final class RuntimeSnapshotCache
{
    public static function remember(string $key, int $seconds, callable $loader): array
    {
        $found = false;
        $value = self::available() ? apcu_fetch($key, $found) : null;

        if ($found && is_array($value)) {
            return $value;
        }
        $value = Cache::remember($key, $seconds, $loader);
        if (self::available()) {
            apcu_store($key, $value, $seconds);
        }

        return $value;
    }

    public static function put(string $key, array $value, int $seconds): void
    {
        Cache::put($key, $value, $seconds);
        if (self::available()) {
            apcu_store($key, $value, $seconds);
        }
    }

    private static function available(): bool
    {
        return function_exists('apcu_enabled') && apcu_enabled();
    }
}
