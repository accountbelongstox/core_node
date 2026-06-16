<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Movie/TV Poster Pipeline - add poster columns to BOTH the subtitles and
 * books tables (canonical contract development-guides/MOVIE_POSTER_PIPELINE.md §5).
 *
 * Posters are fetched from TMDB/OMDB (pycore-at-ingest + a PHP on-demand
 * backfill) and stored as LOCAL files under
 * PathMapper::getStaticPath().'/app_qy_v1/posters/<source_key>.<ext>'. These
 * columns track that local file + its provenance and lifecycle.
 *
 *   - poster_filename   string(255) nullable
 *   - poster_provider   string(32)  nullable   tmdb | omdb | ai
 *   - poster_source_id  string(64)  nullable
 *   - poster_status     string(20)  default 'pending'   pending|ready|failed|none
 *   - poster_meta       json        nullable
 *   - poster_fetched_at timestamp   nullable
 *
 * Add-only (each column guarded by Schema::hasColumn); never rewrites data.
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
        $columns = [
            'poster_filename' => function (Blueprint $table, string $col) {
                $table->string($col, 255)->nullable()
                    ->comment('Local poster filename under static/app_qy_v1/posters');
            },
            'poster_provider' => function (Blueprint $table, string $col) {
                $table->string($col, 32)->nullable()
                    ->comment('Poster provider: tmdb | omdb | ai');
            },
            'poster_source_id' => function (Blueprint $table, string $col) {
                $table->string($col, 64)->nullable()
                    ->comment('Provider result id, e.g. tmdb:movie:603 | imdb:tt0133093');
            },
            'poster_status' => function (Blueprint $table, string $col) {
                $table->string($col, 20)->default('pending')
                    ->comment('Poster lifecycle: pending|ready|failed|none');
            },
            'poster_meta' => function (Blueprint $table, string $col) {
                $table->json($col)->nullable()
                    ->comment('Provider meta: year, original_title, overview, poster_url');
            },
            'poster_fetched_at' => function (Blueprint $table, string $col) {
                $table->timestamp($col)->nullable()
                    ->comment('When the poster was last fetched/stored');
            },
        ];

        SafeMigrationHelper::safeAddColumns($this->connection, $this->subtitlesTable, $columns);
        SafeMigrationHelper::safeAddColumns($this->connection, $this->booksTable, $columns);
    }

    public function down(): void
    {
        $posterColumns = [
            'poster_filename',
            'poster_provider',
            'poster_source_id',
            'poster_status',
            'poster_meta',
            'poster_fetched_at',
        ];

        $connection = $this->connection;
        foreach ([$this->subtitlesTable, $this->booksTable] as $table) {
            $present = [];
            foreach ($posterColumns as $col) {
                if (Schema::connection($connection)->hasColumn($table, $col)) {
                    $present[] = $col;
                }
            }
            if (count($present) === 0) {
                continue;
            }
            Schema::connection($connection)->table($table, function (Blueprint $blueprint) use ($present) {
                $blueprint->dropColumn($present);
            });
        }
    }
};
