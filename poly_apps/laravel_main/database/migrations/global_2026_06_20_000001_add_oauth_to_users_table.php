<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

/**
 * Add OAuth / social-login + verification columns to the MAIN (shared) users table.
 *
 * WHY THE MAIN TABLE (总表), not a per-app sub-table:
 *   Social identity (a Google / GitHub account) belongs to the PERSON, not to one
 *   app. The `users` table is the single canonical account shared by every app
 *   (AppQyV1 / wordnew and the rest), so the provider ids live here and one
 *   Google login resolves to one account across all apps. Per-app learning data
 *   stays in its own sub-tables (e.g. app_qy_v1_user_learning_progress.user_id ->
 *   users.id); only the cross-app IDENTITY is extended here.
 *
 * IDEMPOTENT: uses SafeMigrationHelper::alignTableStructureFromArray, which only
 * ADDS missing columns/indexes (never drops/shrinks). Safe to run on every
 * `php artisan sys:init` / `migrate --force` — re-runs are no-ops.
 *
 * Columns added:
 *   google_id        provider subject id from Google (verified `sub` claim)
 *   github_id        provider numeric id from GitHub
 *   oauth_provider   last provider used to sign in ('google' | 'github' | null)
 *   oauth_avatar     avatar URL supplied by the provider (kept separate from the
 *                    user-uploaded `avatar` so a binding never clobbers it)
 *   phone_verified_at   set when an SMS code is confirmed (phone column already exists)
 *   (email_verified_at already exists on the base users table.)
 *
 * The existing string columns `github` / `wechat` / `weibo` / `qq` are PROFILE
 * links (free text the user types) and are intentionally NOT reused for OAuth —
 * google_id / github_id are the authoritative provider keys for login matching.
 *
 * KEYS: the OAuth CLIENT SECRETS (GOOGLE_CLIENT_SECRET / GITHUB_CLIENT_SECRET)
 * are NOT stored in this table — they live in the backend env / RuntimeConfigurationStore
 * and are used only by the social-auth controller to exchange the code. The
 * public client IDs live in the frontend (see CapSocialAuth KEY notes).
 */
return new class extends Migration
{
    protected $connection = null;
    protected $tableName = 'users';

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'google_id' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => true,
                    'comment' => 'Google OAuth subject id (verified); login matching key',
                ],
                'github_id' => [
                    'type' => 'string',
                    'length' => 64,
                    'nullable' => true,
                    'comment' => 'GitHub OAuth account id (verified); login matching key',
                ],
                'oauth_provider' => [
                    'type' => 'string',
                    'length' => 16,
                    'nullable' => true,
                    'comment' => "Last social provider used: 'google' | 'github' | null",
                ],
                'oauth_avatar' => [
                    'type' => 'string',
                    'nullable' => true,
                    'comment' => 'Avatar URL from the OAuth provider (separate from uploaded avatar)',
                ],
                'phone_verified_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'comment' => 'Set when the user verifies their phone via SMS code',
                ],
            ],
            // Indexed so social login can resolve a user by provider id in O(log n).
            'indexes' => [
                ['columns' => ['google_id']],
                ['columns' => ['github_id']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        $connection = $this->connection ?? config('database.default');
        if (!Schema::connection($connection)->hasTable($this->tableName)) {
            return;
        }
        foreach (['google_id', 'github_id', 'oauth_provider', 'oauth_avatar', 'phone_verified_at'] as $col) {
            if (Schema::connection($connection)->hasColumn($this->tableName, $col)) {
                Schema::connection($connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) use ($col) {
                    $table->dropColumn($col);
                });
            }
        }
    }
};
