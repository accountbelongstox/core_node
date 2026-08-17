<?php

namespace App\Services\Relay;

use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\QueueCenterContract;

/**
 * Relay pair registry: the UI-side half of the both-ends-online gate (R3).
 *
 * RelayMachineRegistry is the machine-side truth (heartbeats); this store is
 * the session-side truth (paired UI sessions with their own TTL). A relay
 * request is dispatched only when BOTH are fresh. Expiry IS the unpair
 * transition - no purge cron.
 */
final class RelayPairRegistry
{
    private const INDEX_KEY = 'relay:pairs:index';

    public static function pair(string $machineId, string $sessionId): array
    {
        $now = now();
        $record = [
            'machine_id' => $machineId,
            'session_id' => $sessionId,
            'paired_at' => $now->toIso8601String(),
        ];
        self::touch($machineId, $record, $now);

        return $record;
    }

    public static function refresh(string $machineId, string $sessionId): bool
    {
        $record = self::record($machineId);
        if ($record === null || ($record['session_id'] ?? '') !== $sessionId) {
            return false;
        }
        self::touch($machineId, $record, now());
        return true;
    }

    public static function isActive(string $machineId, ?string $sessionId = null): bool
    {
        $record = self::record($machineId);
        if ($record === null) {
            return false;
        }
        if (self::expiresAt($record)->lte(now())) {
            return false;
        }
        if ($sessionId === null) {
            return true;
        }
        return ($record['session_id'] ?? '') === $sessionId;
    }

    public static function sessionFor(string $machineId): ?string
    {
        $record = self::record($machineId);
        if ($record === null || self::expiresAt($record)->lte(now())) {
            return null;
        }
        $sessionId = $record['session_id'] ?? null;

        return is_string($sessionId) && $sessionId !== '' ? $sessionId : null;
    }

    public static function release(string $machineId, ?string $sessionId = null): void
    {
        $record = self::record($machineId);
        if ($record === null) {
            return;
        }
        if ($sessionId !== null && ($record['session_id'] ?? '') !== $sessionId) {
            return;
        }
        $index = self::index();
        unset($index[$machineId]);
        QueueCenterCacheStore::get()->forever(self::INDEX_KEY, $index);
    }

    public static function sessionTtlSeconds(): int
    {
        return QueueCenterContract::relayInt('pair_session_ttl_seconds');
    }

    private static function touch(string $machineId, array $record, $now): void
    {
        $record['last_seen_at'] = $now->toIso8601String();
        $record['expires_at'] = $now->clone()
            ->addSeconds(self::sessionTtlSeconds())
            ->toIso8601String();

        $index = self::index();
        $index[$machineId] = $record;
        QueueCenterCacheStore::get()->forever(self::INDEX_KEY, $index);
    }

    private static function record(string $machineId): ?array
    {
        $index = self::index();
        $record = $index[$machineId] ?? null;

        return is_array($record) ? $record : null;
    }

    private static function index(): array
    {
        $index = QueueCenterCacheStore::get()->get(self::INDEX_KEY);

        return is_array($index) ? $index : [];
    }

    private static function expiresAt(array $record)
    {
        return \Illuminate\Support\Carbon::parse((string) ($record['expires_at'] ?? '2000-01-01T00:00:00Z'));
    }
}
