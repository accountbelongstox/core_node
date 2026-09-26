<?php

namespace App\Utils;

use App\Constants\LaravelConfig;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Optional Redis key/value index split into small bucketed hashes
 * ("<prefix>:<namespace>:<bucket>", bucket = md5(field)[0:3]) so every hash
 * stays in the compact listpack encoding (Redis memory-optimization guide).
 * Reads are pipelined HMGETs; a missing or failing Redis disables the index
 * for a short back-off window and callers fall back to their own source of truth.
 */
final class RedisBucketIndex
{
    public const BUCKET_HEX = 3;
    private const KEY_PREFIX = 'resource_index';
    private const META_KEY = 'meta';
    private const STAGING_SUFFIX = '~build';
    private const PIPELINE_BATCH = 1000;
    private const UNAVAILABLE_BACKOFF_SECONDS = 30;
    private const AVAILABLE_RECHECK_SECONDS = 5;

    private static float $disabledUntil = 0.0;
    private static float $verifiedUntil = 0.0;

    public static function available(): bool
    {
        if (microtime(true) < self::$disabledUntil) {
            return false;
        }
        if (microtime(true) < self::$verifiedUntil) {
            return true;
        }
        if (LaravelConfig::REDIS_CLIENT === 'phpredis' && !extension_loaded('redis')) {
            self::$disabledUntil = microtime(true) + self::UNAVAILABLE_BACKOFF_SECONDS;
            return false;
        }
        try {
            self::connection()->ping();
            self::$verifiedUntil = microtime(true) + self::AVAILABLE_RECHECK_SECONDS;
            return true;
        } catch (Throwable $exception) {
            self::disable($exception);
            return false;
        }
    }

    /**
     * @param array<int,string> $fields
     * @return array<string,?string>|null field => stored value (null when absent); null when Redis is unavailable
     */
    public static function lookup(string $namespace, array $fields): ?array
    {
        $byBucket = [];
        $result = [];

        foreach (array_unique($fields) as $field) {
            $byBucket[self::bucket($field)][] = $field;
        }
        try {
            foreach (array_chunk(array_keys($byBucket), self::PIPELINE_BATCH, false) as $buckets) {
                $replies = self::connection()->pipeline(function ($pipe) use ($namespace, $buckets, $byBucket): void {
                    foreach ($buckets as $bucket) {
                        $pipe->hmget(self::key($namespace, (string) $bucket), $byBucket[$bucket]);
                    }
                });
                foreach ($buckets as $position => $bucket) {
                    $values = array_values(is_array($replies[$position] ?? null) ? $replies[$position] : []);
                    foreach ($byBucket[$bucket] as $offset => $field) {
                        $value = $values[$offset] ?? null;
                        $result[$field] = $value === false || $value === null ? null : (string) $value;
                    }
                }
            }
        } catch (Throwable $exception) {
            self::disable($exception);
            return null;
        }

        return $result;
    }

    /** @param array<string,string> $values field => value */
    public static function put(string $namespace, array $values): bool
    {
        return self::write($namespace, $values, []);
    }

    /** @param array<int,string> $fields */
    public static function remove(string $namespace, array $fields): bool
    {
        return self::write($namespace, [], $fields);
    }

    /**
     * Rebuild a namespace from a stream of [field, value] pairs: entries are
     * staged under "<namespace>~build" and each bucket is swapped with RENAME,
     * so readers never observe a half-empty index.
     */
    public static function rebuild(string $namespace, iterable $entries): int
    {
        $staging = $namespace . self::STAGING_SUFFIX;
        $batch = [];
        $count = 0;

        self::clear($staging);
        foreach ($entries as [$field, $value]) {
            $batch[(string) $field] = (string) $value;
            if (count($batch) >= self::PIPELINE_BATCH) {
                self::writeOrFail($staging, $batch);
                $count += count($batch);
                $batch = [];
            }
        }
        if ($batch !== []) {
            self::writeOrFail($staging, $batch);
            $count += count($batch);
        }
        foreach (array_chunk(self::allBuckets(), self::PIPELINE_BATCH) as $buckets) {
            $exists = self::connection()->pipeline(function ($pipe) use ($staging, $buckets): void {
                foreach ($buckets as $bucket) {
                    $pipe->exists(self::key($staging, $bucket));
                }
            });
            self::connection()->pipeline(function ($pipe) use ($namespace, $staging, $buckets, $exists): void {
                foreach ($buckets as $position => $bucket) {
                    if ((int) ($exists[$position] ?? 0) > 0) {
                        $pipe->rename(self::key($staging, $bucket), self::key($namespace, $bucket));
                    } else {
                        $pipe->unlink(self::key($namespace, $bucket));
                    }
                }
            });
        }
        self::setMeta([$namespace . ':entries' => (string) $count, $namespace . ':built_at' => gmdate('c')]);

        return $count;
    }

    public static function clear(string $namespace): void
    {
        foreach (array_chunk(self::allBuckets(), self::PIPELINE_BATCH) as $buckets) {
            self::connection()->pipeline(function ($pipe) use ($namespace, $buckets): void {
                foreach ($buckets as $bucket) {
                    $pipe->unlink(self::key($namespace, $bucket));
                }
            });
        }
    }

    /** @return array<string,int> entry count per namespace */
    public static function count(array $namespaces): array
    {
        $totals = [];

        foreach ($namespaces as $namespace) {
            $totals[$namespace] = 0;
            foreach (array_chunk(self::allBuckets(), self::PIPELINE_BATCH) as $buckets) {
                $replies = self::connection()->pipeline(function ($pipe) use ($namespace, $buckets): void {
                    foreach ($buckets as $bucket) {
                        $pipe->hlen(self::key($namespace, $bucket));
                    }
                });
                $totals[$namespace] += array_sum(array_map('intval', $replies));
            }
        }

        return $totals;
    }

    /** @return array<string,string> */
    public static function meta(): array
    {
        try {
            $meta = self::connection()->hgetall(self::KEY_PREFIX . ':' . self::META_KEY);
            return is_array($meta) ? $meta : [];
        } catch (Throwable $exception) {
            self::disable($exception);
            return [];
        }
    }

    public static function setMeta(array $values): void
    {
        self::connection()->hmset(self::KEY_PREFIX . ':' . self::META_KEY, $values);
    }

    private static function write(string $namespace, array $values, array $removals): bool
    {
        if ($values === [] && $removals === []) {
            return true;
        }
        if (!self::available()) {
            return false;
        }
        try {
            self::writeOrFail($namespace, $values, $removals);
            return true;
        } catch (Throwable $exception) {
            self::disable($exception);
            return false;
        }
    }

    private static function writeOrFail(string $namespace, array $values, array $removals = []): void
    {
        $sets = [];
        $deletes = [];

        foreach ($values as $field => $value) {
            $sets[self::bucket((string) $field)][(string) $field] = (string) $value;
        }
        foreach ($removals as $field) {
            $deletes[self::bucket((string) $field)][] = (string) $field;
        }
        self::connection()->pipeline(function ($pipe) use ($namespace, $sets, $deletes): void {
            foreach ($sets as $bucket => $fields) {
                $pipe->hmset(self::key($namespace, (string) $bucket), $fields);
            }
            foreach ($deletes as $bucket => $fields) {
                $pipe->hdel(self::key($namespace, (string) $bucket), ...$fields);
            }
        });
    }

    /** @return array<string,string> field => value of one bucket; null when Redis is unavailable */
    public static function bucketEntries(string $namespace, string $bucket): ?array
    {
        try {
            $entries = self::connection()->hgetall(self::key($namespace, $bucket));
            return is_array($entries) ? $entries : [];
        } catch (Throwable $exception) {
            self::disable($exception);
            return null;
        }
    }

    /** @return array<int,string> every bucket id in a stable order */
    public static function buckets(): array
    {
        return self::allBuckets();
    }

    /** @return array<int,string> */
    private static function allBuckets(): array
    {
        static $buckets = null;

        if ($buckets === null) {
            $buckets = [];
            for ($index = 0; $index < 16 ** self::BUCKET_HEX; $index++) {
                $buckets[] = str_pad(dechex($index), self::BUCKET_HEX, '0', STR_PAD_LEFT);
            }
        }

        return $buckets;
    }

    private static function bucket(string $field): string
    {
        return substr(md5($field), 0, self::BUCKET_HEX);
    }

    private static function key(string $namespace, string $bucket): string
    {
        return self::KEY_PREFIX . ':' . $namespace . ':' . $bucket;
    }

    private static function connection()
    {
        return Redis::connection(LaravelConfig::REDIS_RESOURCE_INDEX_CONNECTION);
    }

    private static function disable(Throwable $exception): void
    {
        if (microtime(true) >= self::$disabledUntil) {
            Log::warning('[RedisBucketIndex] Redis unavailable; using the fallback path', [
                'error' => $exception->getMessage(),
            ]);
        }
        self::$disabledUntil = microtime(true) + self::UNAVAILABLE_BACKOFF_SECONDS;
        self::$verifiedUntil = 0.0;
    }
}
