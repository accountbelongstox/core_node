<?php

namespace App\Services\DataSync;

/**
 * Received bytes do not match the planned SHA-256, normally because the
 * source file changed after its manifest was taken. The driver skips the
 * file and records it instead of failing the whole session.
 */
final class DataSyncHashMismatchException extends \RuntimeException
{
    public function __construct(string $resource)
    {
        parent::__construct("Resource content changed during synchronization: {$resource}");
    }
}
