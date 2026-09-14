<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;

final class RelayOperationModel extends RelayModel
{
    public function ownerDescriptor(): array
    {
        return [
            'operation_id' => (string) $this->operation_id,
            'device_id' => (string) $this->device_id,
            'pairing_id' => (string) $this->pairing_id,
            'state' => (string) $this->state,
            'revision' => (int) $this->revision,
            'retry_policy' => (string) $this->retry_policy,
            'response_status' => $this->response_status === null ? null : (int) $this->response_status,
            'response_headers' => $this->response_headers,
            'response_body_present' => $this->response_body_present,
            'response_body_base64' => $this->response_body_base64,
            'response_body_ref' => $this->response_blob_id,
            'response_body_sha256' => $this->response_body_sha256,
            'response_body_length' => $this->response_body_length,
            'error_code' => $this->error_code,
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'execution_started_at' => $this->execution_started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
        ];
    }

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
        return RelayTablesMaps::OPERATIONS;
    }
}
