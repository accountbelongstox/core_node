<?php

namespace App\Services\DataSync;

/**
 * The session lock is held by another worker; the request is safe to retry
 * and is answered with a transient HTTP status.
 */
final class DataSyncBusyException extends \RuntimeException
{
    public function __construct()
    {
        parent::__construct('The synchronization session is busy; retry the request.');
    }
}
