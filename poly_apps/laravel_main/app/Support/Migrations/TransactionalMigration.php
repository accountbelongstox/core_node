<?php

namespace App\Support\Migrations;

use Illuminate\Database\Migrations\Migration;

/**
 * Base for data-mutation migrations.
 *
 * Initialization contract §6 (see App\Services\SafeMigrationHelper):
 * Laravel runs up()/down() inside a database transaction when the grammar
 * supports schema transactions (PostgreSQL does), so a mid-run failure rolls
 * back instead of committing a partial rewrite — every retry then starts
 * from a clean, fully idempotent state. Pure-DDL migrations may keep the
 * plain Migration base; anything that UPDATEs/INSERTs/DELETEs business rows
 * belongs here.
 */
abstract class TransactionalMigration extends Migration
{
    // Contract §6: all-or-nothing per run (see class docblock).
    public $withinTransaction = true;
}
