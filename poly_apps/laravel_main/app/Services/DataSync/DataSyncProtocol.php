<?php

namespace App\Services\DataSync;

final class DataSyncProtocol
{
    public const VERSION = 5;
    public const DEFAULT_PORT = 9000;
    public const API_PREFIX = '/api/dashboard/db-manager/sync-peer';
    public const TOKEN_HEADER = 'X-Data-Sync-Token';
    public const REQUEST_TIMEOUT_SECONDS = 120;
    public const CONNECT_TIMEOUT_SECONDS = 10;
    public const TRANSIENT_HTTP_STATUSES = [429, 502, 503, 504];
    public const ACTIVE_STATUSES = ['queued', 'running', 'paused'];
    public const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];
    public const DRIVER_ROLES = ['source', 'fetcher'];
    public const PASSIVE_ROLES = ['receiver', 'exporter'];
    public const ROLES = ['source', 'fetcher', 'receiver', 'exporter'];
    public const KEEPALIVE_SECONDS = 60;
    public const PASSIVE_SUPERSEDE_SECONDS = 180;
    public const PASSIVE_IDLE_SECONDS = 3600;
    public const TERMINAL_RETENTION = 5;
    public const DRIVER_TICK_BUDGET_SECONDS = 8;
    public const COUNTERPART_REFRESH_SECONDS = 5;
    public const CANCELLED_MESSAGE = 'Synchronization session cancelled by the operator.';
}
