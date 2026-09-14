<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayNonceModel extends RelayModel
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::NONCES;
    }
}
