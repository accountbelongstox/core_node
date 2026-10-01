<?php

namespace App\CallPycoreUtils;

use RuntimeException;

/**
 * Typed pycore RPC failure. `errorCode` is pycore's own error code
 * (`route_not_found`, `local_rpc_host_forbidden`, `client_key_*`, ...) or one
 * of the transport codes below; `httpStatus` is 0 when no response arrived.
 */
final class PycoreRpcException extends RuntimeException
{
    public const UNREACHABLE = 'pycore_unreachable';
    public const TRANSPORT_FAILED = 'pycore_transport_failed';
    public const INVALID_RESPONSE = 'pycore_invalid_response';

    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $httpStatus = 0,
        public readonly ?array $details = null
    ) {
        parent::__construct($message);
    }

    public function retryable(): bool
    {
        return $this->httpStatus === 0 || $this->httpStatus >= 500;
    }

    /**
     * The failure in pycore's handler-failure shape, for callers that return arrays.
     *
     * @return array{success: false, error: string, error_code: string, http_status: int, details: ?array}
     */
    public function payload(): array
    {
        return [
            'success' => false,
            'error' => $this->getMessage(),
            'error_code' => $this->errorCode,
            'http_status' => $this->httpStatus,
            'details' => $this->details,
        ];
    }
}
