<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Sentence-library audio pipeline - add the lightweight has_audio cache.
 *
 * has_audio (boolean, default false) is a CACHE ONLY: list views read it to
 * show audio state without stat-ing every file. The single-sentence resolve
 * route (GET .../tts/sentence/audio) always reconciles truth from disk and
 * never trusts this flag over the filesystem. See
 * development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md §3.
 *
 * Add-only via SafeMigrationHelper::safeAddColumns (only adds when missing, so
 * re-runs are safe). down() is intentionally non-destructive: the cache column
 * is left in place to avoid dropping it from a shared, live sentence table.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'sentences');
    }

    public function up(): void
    {
        // hasColumn guard is handled inside SafeMigrationHelper::safeAddColumns
        // (only adds when missing), so re-runs are safe. PG/sqlite-safe: a plain
        // boolean with a default is portable across both drivers.
        SafeMigrationHelper::safeAddColumns($this->connection, $this->tableName, [
            'has_audio' => function (Blueprint $table, string $col) {
                $table->boolean($col)->default(false)
                    ->comment('Cache: sentence audio file exists on disk (reconciled from filesystem)');
            },
        ]);
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback. The
        // has_audio cache column is left in place.
    }
};
