<?php

namespace App\Services\DataSync;

/**
 * Thrown inside long-running discovery steps when the operator requested a
 * cancel: the step aborts at its next internal boundary instead of holding
 * the session lock until the whole inventory or manifest scan completes.
 */
final class DataSyncAbortException extends \RuntimeException
{
    public function __construct()
    {
        parent::__construct('Synchronization session cancelled by the operator.');
    }
}
