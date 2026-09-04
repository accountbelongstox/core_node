<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Resolves the relay owner for the V2 owner plane without requiring a user
 * login: an authenticated request keeps its own user, while anonymous relay
 * traffic acts as the highest-privilege system account.
 */
final class RelayV2OwnerResolver
{
    public function resolve(Request $request): User
    {
        $user = $request->user();

        if ($user instanceof User) {
            return $user;
        }

        $systemOwner = User::highestRoleUser();

        if ($systemOwner === null) {
            throw new RelayV2DomainException('authentication_required', 401);
        }

        return $systemOwner;
    }
}
