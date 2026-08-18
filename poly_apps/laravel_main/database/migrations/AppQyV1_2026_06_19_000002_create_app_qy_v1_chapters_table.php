<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Per-language chapter store (Books v3.1 unified model — see
 * BOOKS_FEATURE_SPECIFICATION.md §3.2).
 *
 * Replaces the single shared {prefix}_chapters table with one table per
 * supported language: {prefix}_chapters_{lang}. The loop mirrors the
 * per-language sentences migration exactly: a hasTable() guard skips any
 * already-created table, and down() is a no-op so a rollback never drops chapter
 * data. Cross-language correspondence is by (source_type, source_key,
 * chapter_index); the same chapter_index across the per-language tables is the
 * same chapter. All language values are codes.
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
        $schema = Schema::connection($this->connection);

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $table = AppQyV1TableMaps::getChapterTableName($lang);

            if ($schema->hasTable($table)) {
                // Data-safety: never recreate/alter a populated table.
                continue;
            }

            // Per-table unique index name (Postgres index names are global).
            $uniqueName = 'uniq_chapter_pos_' . substr(md5($table), 0, 16);

            $schema->create($table, function (Blueprint $t) use ($lang, $uniqueName) {
                $t->bigIncrements('id');
                $t->string('source_type', 20)->index();   // book | subtitle | document | article
                $t->string('source_key', 64)->index();     // FK to books/subtitles source_key
                $t->integer('chapter_index')->default(0);  // 0-based order
                // The lang code (== table suffix).
                $t->string('language', 20)->index();
                // Chapter title in this language; null where 留空 (empty).
                $t->string('title')->nullable();
                // Cross-language chapter group: sha1(source_key . '|chapter|' . chapter_index).
                $t->string('corr_id', 40)->nullable()->index();
                $t->integer('sentence_count')->default(0);
                $t->json('metadata')->nullable();
                $t->timestamps();
                $t->unique(['source_type', 'source_key', 'chapter_index'], $uniqueName);
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop chapter data on rollback.
    }
};
