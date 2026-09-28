<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Third-party assist protocol - poster lease columns on the MEDIA tables.
 *
 * The poster assist track lets external workers (pycore) claim media poster
 * jobs across BOTH the books and subtitles tables, fetch/generate the poster
 * with their own providers (TMDB/OMDB/AI) and report the bytes back under a
 * 60-minute lease. The lease is recorded here, mirroring the cover lease on
 * vocabulary_libraries (AppQyV1_2026_06_12_160000):
 *
 *   - assist_claimed_at  timestamp nullable   lease start (60-minute lease)
 *   - assist_claimed_by  string(64) nullable  claimer identity
 *
 * The assist claim skips rows with a live lease and reclaims expired ones; the
 * AppQyV1PosterCollectionTask maintenance timer clears stale leases. Poster
 * lifecycle itself stays on the poster_* columns (poster_status
 * pending|ready|failed|none, added by AppQyV1_2026_06_15_000001).
 *
 * Add-only via SafeMigrationHelper + guarded by hasTable - idempotent, never
 * drops data, PostgreSQL-safe (plain nullable adds + a single-column index).
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $subtitlesTable;
    protected $booksTable;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->subtitlesTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'subtitles');
        $this->booksTable = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books');
    }

    public function up(): void
    {
        $leaseColumns = [
            'assist_claimed_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable()
                    ->comment('Poster assist lease start (60-minute lease)');
            },
            'assist_claimed_by' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Assist claimer identity (e.g. pycore worker id)');
            },
        ];

        $tables = [
            $this->subtitlesTable => 'idx_subtitles_assist_claimed_at',
            $this->booksTable => 'idx_books_assist_claimed_at',
        ];

        foreach ($tables as $table => $indexName) {
            if (!Schema::connection($this->connection)->hasTable($table)) {
                continue;
            }
            SafeMigrationHelper::safeAddColumns($this->connection, $table, $leaseColumns);
            SafeMigrationHelper::safeAddIndex(
                $this->connection,
                $table,
                ['assist_claimed_at'],
                $indexName
            );
        }
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
