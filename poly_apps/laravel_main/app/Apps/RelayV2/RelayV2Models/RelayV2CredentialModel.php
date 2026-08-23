<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2CredentialModel extends RelayV2Model
{
    protected function casts(): array
    {
        return [
            'credential_version' => 'integer',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayV2TablesMaps::CREDENTIALS;
    }
}
