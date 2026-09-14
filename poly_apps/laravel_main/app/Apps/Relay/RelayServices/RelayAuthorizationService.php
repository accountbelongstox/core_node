<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Models\User;

final class RelayAuthorizationService
{
    public function authorizeRoute(User $user, RelayPairingModel $pairing, string $permission): void
    {
        $token = $user->currentAccessToken();

        if ((int) $pairing->user_id !== (int) $user->getAuthIdentifier()) {
            throw new RelayDomainException('pairing_not_found', 404);
        }
        if ($permission === '' || $permission === 'none') {
            throw new RelayDomainException('route_permission_invalid', 403);
        }
        if ($token !== null
            && !$user->tokenCan($permission)
            && !$user->tokenCan('relay.*')) {
            throw new RelayDomainException('route_permission_denied', 403, ['permission' => $permission]);
        }
    }
}
