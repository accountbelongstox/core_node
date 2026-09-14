<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayDeviceModel extends RelayModel
{
    protected function casts(): array
    {
        return [
            'capabilities' => 'array',
            'current_credential_version' => 'integer',
            'last_seen_at' => 'datetime',
            'credential_expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::DEVICES;
    }
}
