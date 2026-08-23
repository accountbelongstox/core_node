<?php

namespace App\Apps\RelayV2\RelayV2TablesMaps;

use App\Providers\GlobalTablesMap;

final class RelayV2TablesMaps
{
    public const DEVICES = 'RELAY_DEVICES';
    public const ENROLLMENTS = 'RELAY_ENROLLMENTS';
    public const CREDENTIALS = 'RELAY_CREDENTIALS';
    public const PAIRINGS = 'RELAY_PAIRINGS';
    public const OPERATIONS = 'RELAY_OPERATIONS';
    public const BLOBS = 'RELAY_BLOBS';
    public const BLOB_CHUNKS = 'RELAY_BLOB_CHUNKS';
    public const NONCES = 'RELAY_NONCES';
    public const OUTBOX = 'RELAY_OUTBOX';

    public static function connection(): string
    {
        return GlobalTablesMap::getConnection();
    }

    public static function table(string $key): string
    {
        return GlobalTablesMap::getTableName($key);
    }

    private function __construct()
    {
    }
}
