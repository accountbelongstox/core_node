<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Corrective: remove the self-referential cross-database FK
 * users.main_user_id -> users(id) that UserSyncService::createUserTable()
 * emitted for every non-'sqlite' sub-app connection (pre-existing defect,
 * commit 9b97277ef1, 2026-01-13). SQLite resolved the unqualified
 * `REFERENCES "users"` to the SAME file -> an unsatisfiable self-FK on the
 * (empty) sub-app users table, so every sub-app registration insert failed
 * with "FOREIGN KEY constraint failed".
 *
 * Source emitter already removed in UserSyncService (fresh DBs are clean).
 * This repairs ALREADY-created PostgreSQL sub-app `users` tables using an
 * in-place constraint adjustment. Drivers that require a table rebuild are
 * skipped and logged because initialization never drops or rebuilds tables.
 *
 * Idempotent: connections whose users table has no main_user_id FK are skipped.
 */
return new class extends Migration
{
    public function up(): void
    {
        $appKeys = method_exists(AppKeys::class, 'all') ? AppKeys::all() : [
            AppKeys::APPQYV1, AppKeys::MCPV1, AppKeys::SERVERMANAGERV1,
            AppKeys::ACHATV1, AppKeys::CODEMARTV1, AppKeys::ITTOOLSV1,
        ];

        foreach ($appKeys as $appKey) {
            $connection = AppTablePrefixServiceProvider::getConnection($appKey);

            // Main DB guard: matches the current default name AND the legacy
            if ($connection === (string) config('database.default')) {
                continue; // main db: users table has no main_user_id / this FK
            }
            if (!config("database.connections.{$connection}")) {
                continue;
            }
            if (!Schema::connection($connection)->hasTable('users')) {
                continue;
            }

            $db = DB::connection($connection);
            $driver = $db->getDriverName();

            // Discover the FK(s) on users.main_user_id via Laravel's NATIVE,
            // driver-agnostic getForeignKeys() (returns ['name','columns'(list),
            // 'foreign_table',...]). No information_schema / PRAGMA. PostgreSQL
            // returns the constraint name required for the in-place adjustment.
            $mainUserIdFks = array_values(array_filter(
                Schema::connection($connection)->getForeignKeys('users'),
                static fn ($fk) => in_array('main_user_id', $fk['columns'] ?? [], true)
            ));

            // pgsql: dropping a FK is a normal ALTER TABLE DROP CONSTRAINT --
            // no table rebuild needed, and the table's data is preserved.
            if ($driver === 'pgsql') {
                foreach ($mainUserIdFks as $fk) {
                    $name = $fk['name'] ?? null;
                    if ($name === null) {
                        continue;
                    }
                    // Prefer native dropForeign by constraint name; keeps the
                    // table data intact and is idempotent (guarded by the
                    // discovery above).
                    Schema::connection($connection)->table('users', function (Blueprint $table) use ($name) {
                        $table->dropForeign($name);
                    });
                    Log::info("[fkfix] {$connection}.users dropped FK constraint {$name} (pgsql).");
                }

                continue;
            }

            if (empty($mainUserIdFks)) {
                continue;
            }

            Log::warning("[fkfix] {$connection}.users requires a table rebuild on {$driver}; "
                . 'skipped because initialization never drops or rebuilds tables.');
        }
    }

    public function down(): void
    {
        // Intentionally irreversible: re-adding the broken self-FK would
        // re-break sub-app registration. No-op.
    }
};
