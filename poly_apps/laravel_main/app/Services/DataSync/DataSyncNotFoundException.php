<?php

namespace App\Services\DataSync;

/**
 * A synchronization session that does not exist; answered with 404
 * regardless of the (localized) message text.
 */
final class DataSyncNotFoundException extends \InvalidArgumentException
{
    public function __construct()
    {
        parent::__construct(__('data_sync.session_not_found'));
    }
}
