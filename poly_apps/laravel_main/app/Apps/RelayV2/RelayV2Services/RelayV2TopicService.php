<?php

namespace App\Apps\RelayV2\RelayV2Services;

final class RelayV2TopicService
{
    public function device(string $deviceId): string
    {
        return RelayV2Contract::topic('device_wake', [
            'device_id' => $deviceId,
        ]);
    }

    public function owner(int $userId): string
    {
        return RelayV2Contract::topic('owner_roster', [
            'owner_topic_token' => $this->opaque('owner', (string) $userId),
        ]);
    }

    public function pairing(int $userId, string $pairingId): string
    {
        return RelayV2Contract::topic('pairing_operation', [
            'pairing_topic_token' => $this->opaque('pairing', $userId."\0".$pairingId),
        ]);
    }

    private function opaque(string $scope, string $identity): string
    {
        $key = (string) config('app.key');

        return hash_hmac('sha256', $scope."\0".$identity, $key);
    }
}
