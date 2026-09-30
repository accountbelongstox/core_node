<?php

namespace App\Apps\Relay\RelayServices;

use App\Constants\LaravelConfig;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Ephemeral hot state of the fabric lane. Every method degrades silently when
 * Redis is absent: available() turns false for a short back-off window and the
 * callers withdraw the fast lane (the durable lane never depends on Redis).
 */
final class RelayFabricStore
{
    private const PREFIX = 'relay_fabric:';
    private const UNAVAILABLE_BACKOFF_SECONDS = 15;
    private const AVAILABLE_RECHECK_SECONDS = 5;
    private const LEDGER_KEY = 'ledger';

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
        } catch (Throwable) {
            self::disable();

            return false;
        }
    }

    public static function presenceSet(string $deviceId, array $state, int $ttlSeconds): void
    {
        self::run(static fn ($redis) => $redis->setex(self::key('presence:'.$deviceId), $ttlSeconds, json_encode($state)));
    }

    public static function presenceClear(string $deviceId): void
    {
        self::run(static fn ($redis) => $redis->del(self::key('presence:'.$deviceId)));
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function presence(string $deviceId): ?array
    {
        $raw = self::run(static fn ($redis) => $redis->get(self::key('presence:'.$deviceId)));
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @return array<int, array{pairing_id: string, device_id: string}>|null
     */
    public static function rosterGet(int $userId): ?array
    {
        $raw = self::run(static fn ($redis) => $redis->get(self::key('roster:'.$userId)));
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        return is_array($decoded) ? $decoded : null;
    }

    public static function rosterPut(int $userId, array $rows, int $ttlSeconds): void
    {
        self::run(static fn ($redis) => $redis->setex(self::key('roster:'.$userId), $ttlSeconds, json_encode($rows)));
    }

    public static function rosterForget(int $userId): void
    {
        self::run(static fn ($redis) => $redis->del(self::key('roster:'.$userId)));
    }

    /**
     * True when this call created the marker (first sight of the operation).
     */
    public static function operationFirst(string $operationId, int $ttlSeconds): bool
    {
        $result = self::run(static fn ($redis) => $redis->set(self::key('op:'.$operationId), '1', 'EX', $ttlSeconds, 'NX'));

        // null = Redis failed mid-call: fail open (publish) rather than drop the frame.
        return $result === null || $result === true || $result === 'OK' || $result === 1;
    }

    /**
     * Fixed one-minute window counter; true while the caller is within the limit.
     */
    public static function rateAllow(int $userId, int $limitPerMinute): bool
    {
        $key = self::key('rate:'.$userId.':'.intdiv(time(), 60));
        $count = self::run(static function ($redis) use ($key): int {
            $value = (int) $redis->incr($key);
            if ($value === 1) {
                $redis->expire($key, 90);
            }

            return $value;
        });

        return is_int($count) && $count <= $limitPerMinute;
    }

    public static function ledgerPush(array $row): void
    {
        self::run(static fn ($redis) => $redis->rpush(self::key(self::LEDGER_KEY), json_encode($row)));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function ledgerPop(int $limit): array
    {
        $key = self::key(self::LEDGER_KEY);
        $items = self::run(static fn ($redis) => $redis->lrange($key, 0, max(0, $limit - 1)));
        $rows = [];

        if (!is_array($items) || $items === []) {
            return [];
        }
        self::run(static fn ($redis) => $redis->ltrim($key, count($items), -1));
        foreach ($items as $item) {
            $decoded = is_string($item) ? json_decode($item, true) : null;
            if (is_array($decoded)) {
                $rows[] = $decoded;
            }
        }

        return $rows;
    }

    private static function key(string $suffix): string
    {
        return self::PREFIX.$suffix;
    }

    private static function connection()
    {
        return Redis::connection(LaravelConfig::REDIS_RELAY_FABRIC_CONNECTION);
    }

    private static function run(callable $operation): mixed
    {
        if (!self::available()) {
            return null;
        }
        try {
            return $operation(self::connection());
        } catch (Throwable) {
            self::disable();

            return null;
        }
    }

    private static function disable(): void
    {
        self::$disabledUntil = microtime(true) + self::UNAVAILABLE_BACKOFF_SECONDS;
        self::$verifiedUntil = 0.0;
    }

    private function __construct()
    {
    }
}
