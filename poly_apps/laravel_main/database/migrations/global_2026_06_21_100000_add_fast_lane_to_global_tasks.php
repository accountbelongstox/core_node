<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;

/**
 * Phase 2 — Shared fast lane + capability columns on global_tasks.
 *
 * Adds the routing columns the dual-client `remote_fast` lane needs, fully
 * additive and default-safe:
 *   - capability:   nullable string tag. NULL = ANY worker eligible (legacy /
 *                   back-compat). When set, only workers advertising the tag may
 *                   claim the task. Vocabulary: audio | image | translate |
 *                   sentence_audio.
 *   - is_fast_tier: marks an interactive fast-track task (user-initiated single
 *                   word/sentence request via the FE `interactive` flag).
 * Plus composite indexes supporting the priority-ordered fast-lane claim.
 *
 * Add-only via SafeMigrationHelper (idempotent — safe to re-run under
 * sys:init / migrate --force). No reader or writer consults these columns until
 * Phase 3, so this migration changes no runtime behaviour. Reversibility is by
 * feature-flag + the columns being unused/default-safe (repo convention:
 * migrations never drop data; a dedicated cleanup migration handles drops).
 */
return new class extends Migration
{
    protected $connection;
    protected string $table = 'global_tasks';

    public function __construct()
    {
        // global_tasks lives on the default ('main') connection.
        $this->connection = (string) config('database.default');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddColumns($this->connection, $this->table, [
            'capability' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()->default(null)
                    ->comment('remote_fast capability tag; NULL = any worker eligible (audio|image|translate|sentence_audio)');
            },
            'is_fast_tier' => function (Blueprint $table, string $col) {
                $table->boolean($col)->default(false)
                    ->comment('Interactive fast-track task (user-initiated single word/sentence)');
            },
        ]);

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['capability'],
            'idx_global_tasks_capability'
        );

        // Fast-lane claim path: WHERE execution_type=? AND status='pending'
        // ORDER BY priority DESC, created_at ASC. Keep it index-friendly.
        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['execution_type', 'status', 'priority'],
            'idx_global_tasks_exec_status_priority'
        );

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['is_fast_tier', 'status', 'priority'],
            'idx_global_tasks_fast_status_priority'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback (columns are
        // default-safe and unused until Phase 3).
    }
};
