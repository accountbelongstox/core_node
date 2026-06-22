<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;

/**
 * Phase 2 — Worker capabilities column.
 *
 * Stores the per-worker capability tag list advertised at registration so the
 * shared `remote_fast` lane can route a task to a worker that can actually do
 * it. pycore registers ['audio','translate']; chrome-mcp registers
 * ['image','translate','sentence_audio']. NULL / [] means the worker only
 * claims NULL-capability (any) fast tasks — backward compatible with existing
 * workers that never send capabilities.
 *
 * Add-only via SafeMigrationHelper. Capability matching is done in PHP after the
 * lockForUpdate pull (NOT a JSON_CONTAINS WHERE), so this stays a plain nullable
 * JSON column that behaves identically on pgsql and sqlite.
 */
return new class extends Migration
{
    protected $connection;
    protected string $table = 'workers';

    public function __construct()
    {
        $this->connection = (string) config('database.default');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddColumns($this->connection, $this->table, [
            'capabilities' => function (Blueprint $table, string $col) {
                $table->json($col)->nullable()
                    ->comment('Worker capability tags for remote_fast routing (audio|image|translate|sentence_audio)');
            },
        ]);
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
