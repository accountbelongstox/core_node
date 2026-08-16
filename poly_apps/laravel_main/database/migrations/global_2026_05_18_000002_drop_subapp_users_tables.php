<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Canonical-identity refactor: retire duplicate per-sub-app `users` and
 * `personal_access_tokens` tables without removing their structures.
 *
 * Identity now lives ONCE in the main `users` table; app-specific user fields
 * live in per-app extension tables keyed by main_user_id. The per-sub-app
 * duplicates created by the old UserSyncService::createUserTable() were the
 * source of the non-ACID dual-write and the registration FK failure.
 *
 * SAFETY: existing tables are retained and logged regardless of row count.
 * Idempotent: missing tables are skipped.
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
                continue; // main DB: the canonical users table
            }
            if (!config("database.connections.{$connection}")) {
                continue;
            }

            foreach (['users', 'personal_access_tokens'] as $table) {
                if (!Schema::connection($connection)->hasTable($table)) {
                    continue;
                }

                $rows = DB::connection($connection)->table($table)->count();
                if ($rows > 0) {
                    Log::warning("[subapp-users-retained] {$connection}.{$table} has {$rows} "
                        . 'row(s) and remains in place. Migrate and verify these rows '
                        . 'against the canonical main users table before disabling legacy access.');
                    continue;
                }

                Log::info("[subapp-users-retained] {$connection}.{$table} is empty and remains in place under the no-table-drop policy.");
            }
        }
    }

    public function down(): void
    {
        // Intentionally irreversible: recreating per-sub-app duplicate users
        // tables would reintroduce the dual-write/FK defect. No-op.
    }
};
