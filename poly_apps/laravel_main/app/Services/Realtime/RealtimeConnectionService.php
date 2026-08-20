<?php

namespace App\Services\Realtime;

use App\Services\Relay\RelayHubAuthService;
use App\Support\QueueCenterContract;

class RealtimeConnectionService
{
    /**
     * Mercure hub connection form (the realtime plane on the frankenphp
     * server): hub URL, exact topics and a short-lived subscriber token.
     * Queue Center is a public control plane, but the hub stays closed to
     * anonymous subscribers; the token grants only the requested topics.
     */
    public function hubConnection(array $topics = [], array $extra = []): array
    {
        return array_merge(RelayHubAuthService::issueForTopics('queue-center', $topics), [
            'auth_mode' => 'jwt',
            'protocol' => QueueCenterContract::relayHubString('protocol'),
        ], $extra);
    }
}
