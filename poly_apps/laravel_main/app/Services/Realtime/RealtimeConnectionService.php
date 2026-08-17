<?php

namespace App\Services\Realtime;

use App\Support\QueueCenterContract;

class RealtimeConnectionService
{
    /**
     * Mercure hub connection form (the realtime plane on the frankenphp
     * server): hub URL + topics + auth mode. pycore and the UIs both render
     * this; tokens are issued per identity by RelayHubAuthService.
     */
    public function hubConnection(array $topics = [], array $extra = []): array
    {
        return array_merge([
            'transport' => 'mercure',
            'hub_url' => rtrim((string) config('app.url'), '/').QueueCenterContract::relayHubString('path'),
            'topics' => $topics,
            'auth_mode' => 'jwt',
            'protocol' => QueueCenterContract::relayHubString('protocol'),
            'token_ttl_seconds' => QueueCenterContract::relayHubInt('token_ttl_seconds'),
            'cookie' => QueueCenterContract::relayHubString('cookie'),
        ], $extra);
    }
}
