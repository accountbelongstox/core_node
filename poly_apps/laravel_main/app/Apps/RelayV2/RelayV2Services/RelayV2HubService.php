<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Services\Relay\RelayHubJwt;

final class RelayV2HubService
{
    public function __construct(private readonly RelayV2TopicService $topics)
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
        foreach ($pairingIds as $pairingId) {
            $topics[] = $this->topics->pairing($userId, (string) $pairingId);
        }

        return $this->authorization('relay-owner:'.$userId, $topics);
    }

    private function authorization(string $subject, array $topics): array
    {
        $ttl = RelayV2Contract::duration('subscriber_token_seconds');
        $hubUrl = RelayV2Contract::publicUrl('mercure_hub');

        return [
            'url' => $hubUrl,
            'topic' => (string) ($topics[0] ?? ''),
            'topics' => array_values(array_unique($topics)),
            'subscriber_token' => RelayHubJwt::subscriberTokenForTtl($subject, $topics, $ttl, $hubUrl),
            'expires_in_seconds' => $ttl,
            'contract_digest' => RelayV2Contract::digest(),
        ];
    }
}
