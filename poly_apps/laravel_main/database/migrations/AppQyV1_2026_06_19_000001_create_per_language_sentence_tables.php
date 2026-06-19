<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Per-language authoritative sentence store (Books v3 unified model — see
 * development-guides/BOOKS_FEATURE_SPECIFICATION.md §3.1).
 *
 * Replaces the single shared {prefix}_sentences table with one table per
 * supported language: {prefix}_sentences_{lang}. The loop mirrors
 * AppQyV1_2026_05_19_000000_create_tts_cache_dictionary_tables.php exactly:
 * a hasTable() guard skips any already-populated table (no recreate/alter),
 * and down() is a no-op so a rollback never drops sentence data.
 *
 * Each sentence is deduped within its language table by content_id
 * (md5(lowercase(collapse(strip_punctuation(text)))) — language-agnostic key).
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
            $table = AppQyV1TableMaps::getSentenceTableName($lang);

            if ($schema->hasTable($table)) {
                // Data-safety: never recreate/alter a populated table.
                continue;
            }

            $schema->create($table, function (Blueprint $t) {
                $t->bigIncrements('id');
                // Language-agnostic content key, unique within this table.
                $t->string('content_id', 32)->unique();
                // Legacy compat key sha1(normalize(text) . '|' . lang).
                $t->string('sentence_id', 64)->index();
                // Cross-language correspondence group id (see spec §5).
                $t->string('corr_id', 40)->nullable()->index();
                $t->text('text');
                // The lang code (== table suffix).
                $t->string('language', 20)->index();
                // AI enrich-only fields.
                $t->text('explanation')->nullable();
                $t->text('ai_commentary')->nullable();
                $t->text('grammar')->nullable();
                $t->text('special_usage')->nullable();
                // Relative path cache "{lang}/{content_id}.mp3".
                $t->string('audio')->nullable();
                // DB flag ONLY; the file on disk is truth (spec §6).
                $t->boolean('has_audio')->default(false)->index();
                $t->integer('occurrence_count')->default(1);
                $t->json('metadata')->nullable();
                // TTS process-state column set (mirrors the canonical tables).
                $t->string('tts_status', 20)->nullable()->index();
                $t->integer('tts_attempts')->default(0);
                $t->text('tts_error')->nullable();
                $t->dateTime('tts_locked_at')->nullable()->index();
                $t->string('tts_locked_by', 100)->nullable();
                $t->integer('tts_priority')->default(0)->index();
                $t->dateTime('tts_requested_at')->nullable();
                $t->dateTime('tts_completed_at')->nullable();
                $t->timestamps();
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: never drop sentence data on rollback.
    }
};
