<?php

namespace App\Services\Relay;

use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\QueueCenterContract;
use Illuminate\Support\Str;

/**
 * Relay request/response store: the data-plane half of the relay.
 *
 * Wake updates only carry ids and sizes; the bodies live here, keyed by
 * request_id, expiring with the contract request TTL. No queue, no cron -
 * expiry is the abandonment transition (the pair refuses while offline, so
 * nothing is ever stored-and-forwarded across an offline gap).
 */
final class RelayRequestStore
{
    private const REQUEST_KEY = 'relay:request:%s';
    private const RESPONSE_KEY = 'relay:response:%s';

    public static function newRequestId(): string
    {
        return 'req_'.Str::uuid()->toString();
    }

    public static function putRequest(string $machineId, string $requestId, array $payload): void
    {
        QueueCenterCacheStore::get()->put(
            self::key(self::REQUEST_KEY, $machineId, $requestId),
            $payload,
            now()->addSeconds(self::ttlSeconds())
        );
    }

    public static function getRequest(string $machineId, string $requestId): ?array
    {
        return self::get(self::REQUEST_KEY, $machineId, $requestId);
    }

    public static function putResponse(string $machineId, string $requestId, array $payload): void
    {
        QueueCenterCacheStore::get()->put(
            self::key(self::RESPONSE_KEY, $machineId, $requestId),
            $payload,
            now()->addSeconds(self::ttlSeconds())
        );
    }

    public static function getResponse(string $machineId, string $requestId): ?array
    {
        return self::get(self::RESPONSE_KEY, $machineId, $requestId);
    }

    public static function ttlSeconds(): int
    {
        return QueueCenterContract::relayInt('request_ttl_seconds');
    }

    private static function get(string $template, string $machineId, string $requestId): ?array
    {
        $payload = QueueCenterCacheStore::get()->get(self::key($template, $machineId, $requestId));

        return is_array($payload) ? $payload : null;
    }

    private static function key(string $template, string $machineId, string $requestId): string
    {
        return sprintf($template, $machineId.':'.$requestId);
    }
}
