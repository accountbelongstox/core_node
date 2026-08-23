<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2EnrollmentModel extends RelayV2Model
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
        return RelayV2TablesMaps::ENROLLMENTS;
    }
}
