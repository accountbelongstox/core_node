<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2OutboxModel extends RelayV2Model
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
        return RelayV2TablesMaps::OUTBOX;
    }
}
