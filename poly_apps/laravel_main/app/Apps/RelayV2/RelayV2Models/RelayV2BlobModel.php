<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2BlobModel extends RelayV2Model
{
    protected function casts(): array
    {
        return [
            'expected_length' => 'integer',
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
        return RelayV2TablesMaps::BLOBS;
    }
}
