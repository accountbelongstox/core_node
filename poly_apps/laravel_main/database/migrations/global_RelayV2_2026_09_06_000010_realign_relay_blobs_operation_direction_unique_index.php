<?php

use App\Providers\GlobalTablesMap;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        // The blobs table shipped with UNIQUE (operation_id, direction,
        // expected_sha256) but the relay contract moved to claim-epoch-scoped
        // allocations: every new claim epoch must be able to allocate a fresh
        // response blob even while an older epoch's row still exists until
        // retention GC removes it. The create-table migration was edited in
        // place, so a database that had already run it kept the old index:
        // any epoch-rotated allocate INSERT then violated the stale
        // constraint and surfaced as an uncaught SQLSTATE 23505 (HTTP 500)
        // retry loop. Reconcile the drift in place.
        SafeMigrationHelper::safeAddUniqueIndex(
            GlobalTablesMap::getConnection(),
            GlobalTablesMap::getTableName('RELAY_BLOBS'),
            ['operation_id', 'direction', 'claim_epoch'],
            'relay_blobs_operation_direction_uq'
        );

        SafeMigrationHelper::safeAddIndex(
            GlobalTablesMap::getConnection(),
            GlobalTablesMap::getTableName('RELAY_BLOBS'),
            ['operation_id', 'claim_epoch'],
            'relay_blobs_operation_epoch_idx'
        );
    }

    public function down(): void
    {
    }
};
