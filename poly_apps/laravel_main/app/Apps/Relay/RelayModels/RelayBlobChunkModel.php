<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayBlobChunkModel extends RelayModel
{
    protected function casts(): array
    {
        return [
            'chunk_index' => 'integer',
            'chunk_length' => 'integer',
            'stored_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayTablesMaps::BLOB_CHUNKS;
    }
}
