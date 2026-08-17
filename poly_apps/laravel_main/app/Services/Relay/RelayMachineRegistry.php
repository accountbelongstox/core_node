<?php

namespace App\Services\Relay;

use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\QueueCenterContract;

/**
 * Relay machine presence: the server-side truth for both-ends-online gating.
 *
 * The presence channel roster (pycore.machines) drives UI notifications; the
 * TTL heartbeat written here is the authoritative gate a relay request is
 * checked against (R3). Expiry IS the offline transition - no purge cron.
 */
final class RelayMachineRegistry
{
    private const INDEX_KEY = 'relay:machines:index';

    /**
     * Machine-id charset: keys are interpolated into cache keys and channel
     * names on every end, so they stay a strict flat vocabulary.
     */
    public const ID_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/';

    public static function isValidId(string $machineId): bool
    {
        return (bool) preg_match(self::ID_PATTERN, $machineId);
    }

    public static function register(string $machineId, array $meta = []): array
    {
        $now = now();
        $record = [
            'machine_id' => $machineId,
            'label' => (string) ($meta['label'] ?? $machineId),
            'capabilities' => array_values(array_filter(
                $meta['capabilities'] ?? [],
                'is_string'
            )),
            'hostname' => (string) ($meta['hostname'] ?? ''),
            'platform' => (string) ($meta['platform'] ?? ''),
            'registered_at' => $now->toIso8601String(),
        ];

        self::touch($machineId, $record, $now);

        return $record;
    }

    public static function heartbeat(string $machineId): bool
    {
        $record = self::record($machineId);
        if ($record === null) {
            return false;
        }
        self::touch($machineId, $record, now());
        return true;
    }

    public static function unregister(string $machineId): void
    {
        $index = self::index();
        unset($index[$machineId]);
        QueueCenterCacheStore::get()->forever(self::INDEX_KEY, $index);
    }

    public static function isOnline(string $machineId): bool
    {
        $record = self::record($machineId);
        if ($record === null) {
            return false;
        }
        return self::expiresAt($record)->isFuture();
    }

    /**
     * @return array<int, array{machine_id: string, label: string, capabilities: array<int, string>, hostname: string, platform: string, last_seen_at: string}>
     */
    public static function listOnline(): array
    {
        $now = now();
        $machines = [];
        $index = self::index();
        $dirty = false;
        foreach ($index as $machineId => $record) {
            if (!is_array($record) || self::expiresAt($record)->lte($now)) {
                unset($index[$machineId]);
                $dirty = true;
                continue;
            }
            $machines[] = [
                'machine_id' => $machineId,
                'label' => (string) ($record['label'] ?? $machineId),
                'capabilities' => array_values(array_filter(
                    $record['capabilities'] ?? [],
                    'is_string'
                )),
                'hostname' => (string) ($record['hostname'] ?? ''),
                'platform' => (string) ($record['platform'] ?? ''),
                'last_seen_at' => (string) ($record['last_seen_at'] ?? ''),
            ];
        }
        if ($dirty) {
            QueueCenterCacheStore::get()->forever(self::INDEX_KEY, $index);
        }
        usort($machines, static fn (array $a, array $b): int => strcmp($a['machine_id'], $b['machine_id']));

        return $machines;
    }

    private static function touch(string $machineId, array $record, $now): void
    {
        $record['last_seen_at'] = $now->toIso8601String();
        $record['expires_at'] = $now->clone()
            ->addSeconds(self::offlineAfterSeconds())
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

    public static function offlineAfterSeconds(): int
    {
        return QueueCenterContract::relayInt('machine_offline_after_seconds');
    }

    public static function heartbeatSeconds(): int
    {
        return QueueCenterContract::relayInt('machine_heartbeat_seconds');
    }
}
