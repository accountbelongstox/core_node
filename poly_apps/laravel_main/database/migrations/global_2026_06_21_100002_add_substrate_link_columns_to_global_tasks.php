<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;

/**
 * Phase 5 — Substrate unification link columns on global_tasks.
 *
 * Lets a generic GlobalTask point back at the canonical AppQyV1 dictionary row
 * it represents, so the dual-write path can keep both in sync and the eventual
 * cutover knows which row to project completion onto:
 *   - dict_row_id / dict_language / dict_row_table : the canonical row identity.
 *   - sync_to_dict_at : last time completion was projected back (syncToDictRow).
 *   - group_key       : logical media grouping (word md5 / article hash).
 *
 * Add-only via SafeMigrationHelper. All columns nullable/default-safe; unused
 * unless APPQYV1_DUAL_WRITE_GLOBAL is enabled.
 */
return new class extends Migration
{
    protected $connection;
    protected string $table = 'global_tasks';

    public function __construct()
    {
        $this->connection = (string) config('database.default');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddColumns($this->connection, $this->table, [
            'dict_row_id' => function (Blueprint $table, string $col) {
                $table->unsignedBigInteger($col)->nullable()
                    ->comment('Linked canonical dictionary row id (substrate unification)');
            },
            'dict_language' => function (Blueprint $table, string $col) {
                $table->string($col, 10)->nullable()
                    ->comment('Linked dictionary row language code');
            },
            'dict_row_table' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Linked dictionary row table name ({prefix}_tts_cache_{lang} / article)');
            },
            'sync_to_dict_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable()
                    ->comment('Last time this task completion was projected back to its dict row');
            },
            'group_key' => function (Blueprint $table, string $col) {
                $table->string($col, 191)->nullable()
                    ->comment('Logical media grouping key (word md5 / article hash)');
            },
        ]);

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['dict_row_id', 'dict_language'],
            'idx_global_tasks_dict_row'
        );

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->table,
            ['group_key'],
            'idx_global_tasks_group_key'
        );
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
