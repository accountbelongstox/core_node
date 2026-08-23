<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2DeviceModel extends RelayV2Model
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
        return RelayV2TablesMaps::DEVICES;
    }
}
