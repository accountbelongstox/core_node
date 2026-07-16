<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent sys:init self-heal for the seeded admin account and default
 * manager preferences. Upgrades legacy adminroot rows (rolelevel=1) to the
 * super-admin tier expected by User::isSuperAdmin() / Settings server tab.
 */
return new class extends Migration
{
    protected $connection = null;
    protected $tableName = 'users';
    protected $adminUsername = 'adminroot';

    public function up(): void
    {
        $connection = $this->connection ?? config('database.default');

        if (!Schema::connection($connection)->hasTable($this->tableName)) {
            return;
        }

        $admin = DB::connection($connection)
            ->table($this->tableName)
            ->where('username', $this->adminUsername)
            ->first();

        if ($admin === null) {
            return;
        }

        $updates = [];

        if ((int) ($admin->rolelevel ?? 0) < 100) {
            $updates['rolelevel'] = 100;
            $updates['rolename'] = 'Super Administrator';
        }

        $defaultPreferences = [
            'theme' => 'dark',
            'language' => 'en',
            'favorites' => [],
            'recentTools' => [],
        ];

        $rawPrefs = $admin->preferences ?? null;
        $decoded = null;
        if (is_string($rawPrefs) && $rawPrefs !== '') {
            $decoded = json_decode($rawPrefs, true);
        }

        if ($rawPrefs === null || $rawPrefs === '' || !is_array($decoded) || $decoded === []) {
            $updates['preferences'] = json_encode($defaultPreferences);
        }

        if ($updates !== []) {
            $updates['updated_at'] = now();
            DB::connection($connection)
                ->table($this->tableName)
                ->where('id', $admin->id)
                ->update($updates);
        }
    }

    public function down(): void
    {
        // Non-destructive self-heal; no rollback.
    }
};
