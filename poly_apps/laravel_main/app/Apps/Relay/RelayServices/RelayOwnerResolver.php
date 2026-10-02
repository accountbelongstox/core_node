<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Helpers\AuthHelper;
use App\Models\User;
use Illuminate\Http\Request;

final class RelayOwnerResolver
{
    public function resolve(Request $request): User
    {
        $user = AuthHelper::requireAuth($request);

        if ($user instanceof User) {
            return $user;
        }

        throw new RelayDomainException('authentication_required', 401);
    }
}
