<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2BlobChunkModel extends RelayV2Model
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
        return RelayV2TablesMaps::BLOB_CHUNKS;
    }
}
