<?php

namespace App\Services\Relay;

/**
 * Relay dispatcher: the wake/control plane on top of the Mercure hub.
 *
 * Gate (R3) + publish. The gate is checked here AND at store time - the
 * registry pair (machine heartbeat + pair session) is the only both-ends-
 * online truth; the hub itself has no application presence.
 */
final class RelayDispatcher
{
    /**
     * Both-ends-online gate: machine heartbeat fresh AND pair session fresh.
     */
    public static function gate(string $machineId, ?string $sessionId = null): bool
    {
        return RelayMachineRegistry::isOnline($machineId)
            && RelayPairRegistry::isActive($machineId, $sessionId);
    }

    /**
     * Deliver the complete private relay.request control frame.
     */
    public static function dispatchRequest(string $machineId, array $frame): ?string
    {
        return RelayHubPublisher::publish(
            self::pairTopic($machineId),
            self::frame($frame),
            true,
            \App\Support\QueueCenterContract::relayEvent('request')
        );
    }

    /**
     * Deliver the complete private relay.response control frame.
     */
    public static function dispatchResponse(string $machineId, array $frame): ?string
    {
        return RelayHubPublisher::publish(
            self::pairTopic($machineId),
            self::frame($frame),
            true,
            \App\Support\QueueCenterContract::relayEvent('response')
        );
    }

    /**
     * Roster announcement: public roster.update on the machines topic. The
     * HTTP roster endpoint stays the truth; this is the push delta.
     */
    public static function announceRoster(string $machineId, bool $online, array $record = []): ?string
    {
        return RelayHubPublisher::publish(
            self::machinesTopic(),
            self::frame([
                'machine_id' => $machineId,
                'online' => $online,
                'label' => (string) ($record['label'] ?? $machineId),
                'capabilities' => array_values(array_filter($record['capabilities'] ?? [], 'is_string')),
            ]),
            false,
            \App\Support\QueueCenterContract::relayEvent('roster')
        );
    }

    public static function pairTopic(string $machineId): string
    {
        return \App\Support\QueueCenterContract::relayTopic('pair', ['machine_id' => $machineId]);
    }

    public static function machinesTopic(): string
    {
        return \App\Support\QueueCenterContract::relayTopic('machines');
    }

    private static function frame(array $frame): string
    {
        return json_encode($frame, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    }
}
