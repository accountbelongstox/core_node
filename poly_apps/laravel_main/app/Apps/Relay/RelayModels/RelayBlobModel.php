<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayBlobModel extends RelayModel
{
    protected function casts(): array
    {
        return [
            'expected_length' => 'integer',
            'operation_revision' => 'integer',
            'claim_epoch' => 'integer',
            'final_length' => 'integer',
            'received_chunk_count' => 'integer',
            'received_length' => 'integer',
            'revision' => 'integer',
            'finalized_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::BLOBS;
    }
}
