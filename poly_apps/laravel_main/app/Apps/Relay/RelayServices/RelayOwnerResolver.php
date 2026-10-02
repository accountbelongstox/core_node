<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Helpers\AuthHelper;
use App\Models\User;
use App\Services\ClientKey\ClientKeyAuthService;
use Illuminate\Http\Request;

/**
 * Owner identity: the Sanctum user, else a verified client-key caller acting
 * as the shared fleet owner (`RelayFleetScope::clientKeyOwner`).
 */
final class RelayOwnerResolver
{
    public function resolve(Request $request): User
    {
        $user = self::sessionUser($request);

        if ($user instanceof User) {
            return $user;
        }
        if (self::isClientKeyCall($request)) {
            $user = RelayFleetScope::clientKeyOwner();
        }
        if ($user instanceof User) {
            return $user;
        }

        throw new RelayDomainException('authentication_required', 401);
    }

    /**
     * Limiter identity: the session user id, or the client-key owner id plus
     * caller IP so keyed machines do not share one bucket.
     */
    public static function rateKey(Request $request): ?string
    {
        $user = self::sessionUser($request);
        $owner = null;

        if ($user instanceof User) {
            return 'user:'.$user->getAuthIdentifier();
        }
        if (!self::isClientKeyCall($request)) {
            return null;
        }
        $owner = RelayFleetScope::clientKeyOwner();

        return $owner instanceof User ? 'client:'.$owner->getAuthIdentifier().':'.$request->ip() : null;
    }

    private static function sessionUser(Request $request): ?User
    {
        $user = AuthHelper::requireAuth($request) ?? $request->user('sanctum');

        return $user instanceof User ? $user : null;
    }

    private static function isClientKeyCall(Request $request): bool
    {
        return ClientKeyAuthService::hasSignature($request) && ClientKeyAuthService::isMachineCall($request);
    }
}
