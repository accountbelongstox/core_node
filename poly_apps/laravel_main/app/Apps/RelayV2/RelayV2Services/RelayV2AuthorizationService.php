<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Models\RelayV2PairingModel;
use App\Models\User;

final class RelayV2AuthorizationService
{
    public function authorizeRoute(User $user, RelayV2PairingModel $pairing, string $permission): void
    {
        $token = $user->currentAccessToken();

        if ((int) $pairing->user_id !== (int) $user->getAuthIdentifier()) {
            throw new RelayV2DomainException('pairing_not_found', 404);
        }
        if ($permission === '' || $permission === 'none') {
            throw new RelayV2DomainException('route_permission_invalid', 403);
        }
        if ($token !== null
            && !$user->tokenCan($permission)
            && !$user->tokenCan('relay.*')) {
            throw new RelayV2DomainException('route_permission_denied', 403, ['permission' => $permission]);
        }
    }
}
