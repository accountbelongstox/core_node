<?php

namespace App\Services\DataSync;

use App\Support\ServiceContract;

/**
 * Protocol values shared by every node. The version, the status and role
 * lists, the terminal retention and the default peer port come from
 * config/service_contract.json#data_sync; the UI reads the same block.
 */
final class DataSyncProtocol
{
    private const CONTRACT_SECTION = 'data_sync.';
    public const API_PREFIX = '/api/dashboard/db-manager/sync-peer';
    public const TOKEN_HEADER = 'X-Data-Sync-Token';
    public const REQUEST_TIMEOUT_SECONDS = 120;
    public const CONNECT_TIMEOUT_SECONDS = 10;
    public const TRANSIENT_HTTP_STATUSES = [429, 502, 503, 504];
    public const KEEPALIVE_SECONDS = 60;
    public const PASSIVE_SUPERSEDE_SECONDS = 180;
    public const PASSIVE_IDLE_SECONDS = 3600;
    public const DRIVER_TICK_BUDGET_SECONDS = 8;
    public const COUNTERPART_REFRESH_SECONDS = 5;

    public static function version(): int
    {
        return ServiceContract::positiveInt(self::CONTRACT_SECTION . 'protocol_version');
    }

    /** @return list<string> */
    public static function activeStatuses(): array
    {
        return ServiceContract::stringList(self::CONTRACT_SECTION . 'active_statuses');
    }

    /** @return list<string> */
    public static function terminalStatuses(): array
    {
        return ServiceContract::stringList(self::CONTRACT_SECTION . 'terminal_statuses');
    }

    /** @return list<string> */
    public static function driverRoles(): array
    {
        return ServiceContract::stringList(self::CONTRACT_SECTION . 'driver_roles');
    }

    /** @return list<string> */
    public static function passiveRoles(): array
    {
        return ServiceContract::stringList(self::CONTRACT_SECTION . 'passive_roles');
    }

    /** @return list<string> roles that write into this node and keep a pre-transfer backup */
    public static function writerRoles(): array
    {
        return ServiceContract::stringList(self::CONTRACT_SECTION . 'writer_roles');
    }

    /** @return list<string> */
    public static function roles(): array
    {
        return array_merge(self::driverRoles(), self::passiveRoles());
    }

    public static function terminalRetention(): int
    {
        return ServiceContract::positiveInt(self::CONTRACT_SECTION . 'terminal_retention');
    }

    /** Port for a bare peer host; the contract names the ports entry it uses. */
    public static function defaultPort(): int
    {
        return ServiceContract::positiveInt(ServiceContract::string(self::CONTRACT_SECTION . 'default_port_ref'));
    }

    public static function cancelledMessage(): string
    {
        return __('data_sync.cancelled_by_operator');
    }
}
