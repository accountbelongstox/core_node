<?php

namespace App\Apps\Relay\RelayServices;

final class RelayTopicService
{
    public function request(string $deviceId): string
    {
        return RelayContract::topic('request', [
            'device_id' => $deviceId,
        ]);
    }

    public function response(string $ownerToken, string $deviceId): string
    {
        return RelayContract::topic('response', [
            'owner_topic_token' => $ownerToken,
            'device_id' => $deviceId,
        ]);
    }

    public function owner(int $userId): string
    {
        return RelayContract::topic('owner_events', [
            'owner_topic_token' => $this->ownerToken($userId),
        ]);
    }

    public function ownerToken(int $userId): string
    {
        return $this->opaque('owner', (string) $userId);
    }

    private function opaque(string $scope, string $identity): string
    {
        $key = (string) config('app.key');

        return hash_hmac('sha256', $scope."\0".$identity, $key);
    }
}
