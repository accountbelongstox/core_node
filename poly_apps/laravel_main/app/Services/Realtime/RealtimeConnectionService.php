<?php

namespace App\Services\Realtime;

use App\Services\Relay\RelayHubAuthService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Log;

class RealtimeConnectionService
{
    /** Topic-scoped Mercure authorization shared by every realtime consumer. */
    public function hubConnection(array $topics = [], array $extra = []): array
    {
        $topics = array_values(array_unique(array_filter(
            $topics,
            static fn (mixed $topic): bool => is_string($topic) && $topic !== ''
        )));

        $connection = RelayHubAuthService::connectionForTopics($topics);

        try {
            // Short-lived subscriber JWT for headless consumers (pycore Queue
            // Center): they re-derive the whole connection from this payload
            // and cannot obtain the cookie-issued session token. Fall back to
            // the token-less form when the hub subscriber key is missing —
            // consumers then degrade to polling instead of losing the overview.
            $connection = RelayHubAuthService::issueForTopics('queue-center', $topics);
        } catch (\Throwable $e) {
            Log::warning('[QueueCenter] Mercure subscriber token not issued', [
                'error' => $e->getMessage(),
                'topics' => $topics,
            ]);
        }

        return array_merge($connection, [
            'auth_mode' => 'bearer',
            'protocol' => QueueCenterContract::relayHubString('protocol'),
        ], $extra);
    }
}
