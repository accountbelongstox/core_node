<?php

namespace App\Services\DataSync;

final class DataSyncProtocol
{
    public const VERSION = 3;
    public const DEFAULT_PORT = 9000;
    public const API_PREFIX = '/api/dashboard/db-manager/sync-peer';
    public const TOKEN_HEADER = 'X-Data-Sync-Token';
    public const REQUEST_TIMEOUT_SECONDS = 60;
    public const TRANSIENT_HTTP_STATUSES = [429, 502, 503, 504];
}
