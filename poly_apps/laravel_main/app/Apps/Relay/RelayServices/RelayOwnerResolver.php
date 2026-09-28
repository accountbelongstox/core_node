<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Models\User;
use Illuminate\Http\Request;

final class RelayOwnerResolver
{
    public function resolve(Request $request): User
    {
        $user = RelayFleetScope::publicOwner();

        if ($user instanceof User) {
            return $user;
        }

        throw new RelayDomainException('group_empty', 503);
    }
}
