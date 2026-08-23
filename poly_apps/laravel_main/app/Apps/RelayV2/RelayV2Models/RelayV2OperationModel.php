<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;

final class RelayV2OperationModel extends RelayV2Model
{
    protected function casts(): array
    {
        return [
            'normalized_query' => 'array',
            'filtered_headers' => 'array',
            'request_body_present' => 'boolean',
            'request_body_length' => 'integer',
            'revision' => 'integer',
            'attempt' => 'integer',
            'claim_epoch' => 'integer',
            'lease_expires_at' => 'datetime',
            'response_status' => 'integer',
            'response_headers' => 'array',
            'response_body_present' => 'boolean',
            'response_body_length' => 'integer',
            'accepted_at' => 'datetime',
            'execution_started_at' => 'datetime',
            'completed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    protected static function tableMapKey(): string
    {
        return RelayV2TablesMaps::OPERATIONS;
    }
}
