<?php

namespace App\Services\Realtime;

use App\Services\Relay\RelayHubAuthService;
use App\Support\QueueCenterContract;

class RealtimeConnectionService
{
    /** Topic-scoped Mercure authorization shared by every realtime consumer. */
    public function hubConnection(array $topics = [], array $extra = []): array
    {
        $topics = array_values(array_unique(array_filter(
            $topics,
            static fn (mixed $topic): bool => is_string($topic) && $topic !== ''
        )));

        return array_merge(RelayHubAuthService::issueForTopics('queue-center', $topics), [
            'auth_mode' => 'bearer',
            'protocol' => QueueCenterContract::relayHubString('protocol'),
        ], $extra);
    }
}
