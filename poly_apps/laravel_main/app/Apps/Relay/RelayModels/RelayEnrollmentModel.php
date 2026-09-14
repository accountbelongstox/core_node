<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayEnrollmentModel extends RelayModel
{
    protected function casts(): array
    {
        return [
            'capabilities' => 'array',
            'key_version' => 'integer',
            'claim_attempts' => 'integer',
            'revision' => 'integer',
            'expires_at' => 'datetime',
            'claimed_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::ENROLLMENTS;
    }
}
