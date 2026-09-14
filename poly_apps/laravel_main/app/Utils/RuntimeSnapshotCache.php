<?php

namespace App\Utils;

use Illuminate\Support\Facades\Cache;

final class RuntimeSnapshotCache
{
    public static function remember(string $key, int $seconds, callable $loader): array
    {
        $value = Cache::remember($key, $seconds, $loader);

        return $value;
    }

    public static function put(string $key, array $value, int $seconds): void
    {
        Cache::put($key, $value, $seconds);
    }
}
