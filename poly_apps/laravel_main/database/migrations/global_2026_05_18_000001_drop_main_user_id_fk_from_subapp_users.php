<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
 * This repairs ALREADY-created sub-app `users` tables. SQLite has no
 * DROP CONSTRAINT, so the table must be recreated. Sub-app users tables hold
 * no data until a sub-app registration succeeds (which this very FK blocked),
 * so a guarded drop+recreate is safe. SAFETY: a table with rows is NEVER
 * dropped -- it is skipped and logged, preserving the repo's
 * "migrations never delete data" guarantee.
 *
 * Idempotent: connections whose users table has no main_user_id FK are skipped.
 */
return new class extends Migration
{
    public function up(): void
    {
        $appKeys = method_exists(AppKeys::class, 'all') ? AppKeys::all() : [
            AppKeys::APPQYV1, AppKeys::AWYV0, AppKeys::MCPV1, AppKeys::VIPCLUBV1,
            AppKeys::BANKV1, AppKeys::SERVERMANAGERV1, AppKeys::ACHATV1,
            AppKeys::CODEMARTV1, AppKeys::ITTOOLSV1,
        ];

        foreach ($appKeys as $appKey) {
            $connection = AppTablePrefixServiceProvider::getConnection($appKey);

            if ($connection === 'sqlite') {
                continue; // main db: users table has no main_user_id / this FK
            }
            if (!config("database.connections.{$connection}")) {
                continue;
            }
            if (!Schema::connection($connection)->hasTable('users')) {
                continue;
            }

            $db = DB::connection($connection);

            // Idempotency: only act if a FK on main_user_id actually exists.
            $hasFk = false;
            foreach ($db->select("PRAGMA foreign_key_list('users')") as $fk) {
                if (($fk->from ?? null) === 'main_user_id') {
                    $hasFk = true;
                    break;
                }
            }
            if (!$hasFk) {
                continue;
            }

            // SAFETY: never drop a populated table (preserve data guarantee).
            $rowCount = $db->table('users')->count();
            if ($rowCount > 0) {
                Log::warning("[fkfix] {$connection}.users has {$rowCount} rows and a "
                    . "main_user_id FK; skipped automatic rebuild to avoid data loss. "
                    . "Rebuild this table manually (export, drop, recreate FK-free, reimport).");
                continue;
            }

            // Empty table: safe to drop + recreate FK-free, mirroring the
            // canonical non-sqlite shape in UserSyncService::createUserTable().
            Schema::connection($connection)->drop('users');
            Schema::connection($connection)->create('users', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('main_user_id');
                $table->string('username')->nullable();
                $table->string('name')->nullable();
                $table->string('nickname')->nullable();
                $table->string('email')->nullable();
                $table->string('phone', 20)->nullable();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('remember_token', 100)->nullable();
                $table->text('avatar')->nullable();
                $table->integer('credit')->default(0);
                $table->timestamps();
                // deliberately NO ->foreign('main_user_id')
                $table->index('main_user_id');
                $table->index('username');
                $table->index('email');
                $table->index('nickname');
            });
        }
    }

    public function down(): void
    {
        // Intentionally irreversible: re-adding the broken self-FK would
        // re-break sub-app registration. No-op.
    }
};
