<?php

namespace App\Models\Concerns;

use App\Constants\DbConnections;

/**
 * Pin a model to the shared main database (core_node_main).
 *
 * Implemented as a getConnectionName() override (not a $connection property)
 * so it composes with ANY base class — Model, Authenticatable, or app bases —
 * without PHP trait/property conflicts.
 *
 * Why this matters: Laravel applies `php artisan migrate --database=<app>` by
 * switching the DEFAULT connection for the whole command. A main-db model
 * that relies on the default then silently targets the per-app database and
 * fails with 42P01 (undefined table) — or worse, would write to the wrong
 * schema. With this trait the model's target is invariant.
 */
trait UsesMainConnection
{
    public function getConnectionName()
    {
        return DbConnections::MAIN;
    }
}
