<?php

namespace App\Apps\Relay\RelayServices;

final class RelayTopicService
{
    public function device(string $deviceId): string
    {
        return RelayContract::topic('device_wake', [
            'device_id' => $deviceId,
        ]);
    }

    public function owner(int $userId): string
    {
        return RelayContract::topic('owner_roster', [
            'owner_topic_token' => $this->opaque('owner', (string) $userId),
        ]);
    }

    public function pairing(int $userId, string $pairingId): string
    {
        return RelayContract::topic('pairing_operation', [
            'pairing_topic_token' => $this->opaque('pairing', $userId."\0".$pairingId),
        ]);
    }

    private function opaque(string $scope, string $identity): string
    {
        $key = (string) config('app.key');

        return hash_hmac('sha256', $scope."\0".$identity, $key);
    }
}
