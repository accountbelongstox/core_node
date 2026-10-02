<?php

namespace App\Apps\AgentBus\AgentBusServices;

use App\Apps\AgentBus\AgentBusExceptions\AgentBusException;
use App\Services\Realtime\MercurePublisher;
use App\Services\Relay\RelayHubAuthService;
use App\Services\Relay\RelayHubJwt;
use Illuminate\Support\Facades\Log;

/** Mercure wake channel: ids only, content is read over authenticated HTTP. */
final class AgentBusRealtime
{
    private const STATUS_UNAVAILABLE = 503;

    public static function topic(string $targetKind, string $target = ''): string
    {
        $prefix = AgentBusContract::realtime('topic_prefix');

        return $targetKind === 'broadcast' ? $prefix.'broadcast' : $prefix.$targetKind.':'.$target;
    }

    /** @return array<int, string> */
    public static function topicsForAgent(object $agent): array
    {
        $topics = [self::topic('agent', $agent->agent_id), self::topic('broadcast')];

        foreach (AgentBusService::decodeList($agent->roles) as $role) {
            $topics[] = self::topic('role', $role);
        }
        foreach (AgentBusService::decodeList($agent->channels) as $channel) {
            $topics[] = self::topic('channel', $channel);
        }

        return array_values(array_unique($topics));
    }

    /** Best effort: a missed wake is recovered by the next inbox or heartbeat call. */
    public static function wake(string $targetKind, string $target, string $kind, int $id): void
    {
        $payload = [
            'kind' => $kind,
            'id' => $id,
            'target' => $targetKind === 'broadcast' ? 'broadcast' : $targetKind.':'.$target,
        ];

        try {
            MercurePublisher::publish(
                self::topic($targetKind, $target),
                json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
                true,
                AgentBusContract::realtime('event')
            );
        } catch (\Throwable $e) {
            Log::warning('[AgentBus] Mercure wake not published', [
                'target' => $payload['target'],
                'kind' => $kind,
                'id' => $id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function connection(object $agent): array
    {
        $topics = self::topicsForAgent($agent);
        $ttl = AgentBusContract::limit('realtime_token_ttl_seconds');
        $token = '';

        try {
            $token = RelayHubJwt::subscriberTokenForTtl('agent-bus:'.$agent->agent_id, $topics, $ttl);
        } catch (\Throwable $e) {
            Log::warning('[AgentBus] Mercure subscriber token not issued', ['error' => $e->getMessage()]);
            throw new AgentBusException('realtime_unavailable', self::STATUS_UNAVAILABLE);
        }

        return array_merge(RelayHubAuthService::connectionForTopics($topics), [
            'event' => AgentBusContract::realtime('event'),
            'token' => $token,
            'token_ttl_seconds' => $ttl,
            'auth_mode' => 'bearer',
        ]);
    }

    private function __construct()
    {
    }
}
