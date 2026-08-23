<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Services\Relay\RelayHubJwt;

final class RelayV2TopicService
{
    public function device(string $deviceId): string
    {
        return RelayV2Contract::topic('device_wake', [
            'laravel_api_origin' => RelayHubJwt::servingOrigin(),
            'device_id' => $deviceId,
        ]);
    }

    public function owner(int $userId): string
    {
        return RelayHubJwt::servingOrigin().'/.well-known/relay/v2/owners/'.$this->opaque('owner', (string) $userId);
    }

    public function pairing(int $userId, string $pairingId): string
    {
        return RelayHubJwt::servingOrigin().'/.well-known/relay/v2/pairings/'
            .$this->opaque('pairing', $userId."\0".$pairingId);
    }

    private function opaque(string $scope, string $identity): string
    {
        $key = (string) config('app.key');

        return hash_hmac('sha256', $scope."\0".$identity, $key);
    }
}
