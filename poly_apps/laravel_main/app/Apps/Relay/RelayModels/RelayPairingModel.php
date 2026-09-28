<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayPairingModel extends RelayModel
{
    protected function casts(): array
    {
        return [
            'credential_version' => 'integer',
            'revision' => 'integer',
            'last_seen_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::PAIRINGS;
    }
}
