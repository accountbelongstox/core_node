<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Third-party assist protocol - lease columns.
 *
 * External assist workers (pycore) claim cover work with a 60-minute lease
 * recorded on vocabulary_libraries (assist_claimed_at / assist_claimed_by).
 * The local Octane cover timer skips live leases and reclaims expired ones.
 *
 * TTS note: the intermediate tts_queue table was decommissioned (TTS claim
 * state lives on the canonical tts_cache_{lang} tables as tts_locked_at /
 * tts_locked_by, added by AppQyV1_2026_06_12_000010, and the assist lease
 * reuses those columns with an "assist:" worker prefix). For deployments
 * where the legacy tts_queue table still physically exists, the same lease
 * columns are added there too - guarded by hasTable, so this is a no-op
 * everywhere the table is already gone.
 *
 * Add-only via SafeMigrationHelper - idempotent, never drops data. Runs via
 * sys:init/migrate like every other migration (PostgreSQL-safe: plain
 * nullable column adds + a single-column index).
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        $leaseColumns = [
            'assist_claimed_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable()
                    ->comment('Third-party assist lease start (60-minute lease)');
            },
            'assist_claimed_by' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Assist claimer identity (e.g. pycore worker id)');
            },
        ];

        $libraries = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
        if (Schema::connection($this->connection)->hasTable($libraries)) {
            SafeMigrationHelper::safeAddColumns($this->connection, $libraries, $leaseColumns);
            SafeMigrationHelper::safeAddIndex(
                $this->connection,
                $libraries,
                ['assist_claimed_at'],
                'idx_vocab_lib_assist_claimed_at'
            );
        }

        // Legacy table - only patched where it still exists (see class doc).
        $ttsQueue = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_queue');
        if (Schema::connection($this->connection)->hasTable($ttsQueue)) {
            SafeMigrationHelper::safeAddColumns($this->connection, $ttsQueue, $leaseColumns);
        }
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
