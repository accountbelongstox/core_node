<?php

namespace App\Services\Realtime;

use App\Services\Realtime\RealtimeConnectionService;
use App\Services\Relay\RelayHubJwt;
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
            'hub_url' => RelayHubJwt::hubUrl(),
            'topics' => $topics,
            'auth_mode' => 'jwt',
            'protocol' => QueueCenterContract::relayHubString('protocol'),
            'token_ttl_seconds' => QueueCenterContract::relayHubInt('token_ttl_seconds'),
            'cookie' => QueueCenterContract::relayHubString('cookie'),
        ], $extra);
    }
}
