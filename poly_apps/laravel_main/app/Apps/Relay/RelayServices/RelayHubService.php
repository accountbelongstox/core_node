<?php

namespace App\Apps\Relay\RelayServices;

use App\Services\Relay\RelayHubJwt;

final class RelayHubService
{
    public function __construct(private readonly RelayTopicService $topics)
    {
    }

    public function deviceAuthorization(string $deviceId): array
    {
        $topics = [$this->topics->device($deviceId)];

        return $this->authorization('relay-device:'.$deviceId, $topics);
    }

    public function ownerAuthorization(int $userId, array $pairingIds): array
    {
        $topics = [$this->topics->owner($userId)];

        return $this->authorization('relay-owner:'.$userId, $topics);
    }

    private function authorization(string $subject, array $topics): array
    {
        $ttl = RelayContract::duration('subscriber_token_seconds');
        $hubUrl = RelayContract::publicUrl('mercure_hub');

        return [
            'url' => $hubUrl,
            'topic' => (string) ($topics[0] ?? ''),
            'topics' => array_values(array_unique($topics)),
            'subscriber_token' => RelayHubJwt::subscriberTokenForTtl($subject, $topics, $ttl, $hubUrl),
            'expires_in_seconds' => $ttl,
            'contract_digest' => RelayContract::digest(),
        ];
    }
}
