<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayOutboxModel extends RelayModel
{
    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'private' => 'boolean',
            'publish_attempts' => 'integer',
            'next_attempt_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::OUTBOX;
    }
}
