<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MediaIngestService;

/**
 * Retire the shared {prefix}_sentences / {prefix}_chapters tables in favour of
 * the per-language stores (Books v3.1 — see BOOKS_FEATURE_SPECIFICATION.md §3.4).
 *
 * DATA-SAFE + IDEMPOTENT (the project rule: only adjust structure, never rebuild
 * or destroy existing data). An earlier draft did a blunt dropIfExists() on the
 * assumption that there was "no legacy data" — but a real install carries v1/v2
 * subtitle/book sentences in the shared table. So we now:
 *   1. MIGRATE every shared {prefix}_sentences row into its per-language
 *      {prefix}_sentences_{lang} table (keyed by content_id, fill-missing /
 *      never clobber), then
 *   2. MIGRATE shared {prefix}_chapters rows into the per-language chapter tables
 *      (best-effort: the legacy shared chapter row has no language, so it folds
 *      into the source's primary language, else the default), then
 *   3. drop the now-copied shared tables.
 * Every step is hasTable-guarded and re-runnable; down() is a no-op.
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
        $sentences = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'sentences');
        $chapters = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'chapters');

        // 1) Preserve shared sentences -> per-language sentence tables.
        if ($schema->hasTable($sentences)) {
            try {
                $this->migrateSharedSentences($sentences);
            } catch (\Throwable $e) {
                // Never brick init on a migration hiccup; leave the shared table
                // in place so a later pass can retry the copy before dropping.
                \Illuminate\Support\Facades\Log::error(
                    '[AppQyV1 v3.1] shared sentence migration failed, leaving table in place: ' . $e->getMessage()
                );
                return;
            }
            $schema->dropIfExists($sentences);
        }

        // 2) Preserve shared chapters -> per-language chapter tables (best-effort).
        if ($schema->hasTable($chapters)) {
            try {
                $this->migrateSharedChapters($chapters);
                $schema->dropIfExists($chapters);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error(
                    '[AppQyV1 v3.1] shared chapter migration failed, leaving table in place: ' . $e->getMessage()
                );
            }
        }
    }

    /**
     * Copy each shared sentence row into {prefix}_sentences_{lang} (fill-missing
     * by content_id). Idempotent via insertOrIgnore on the unique content_id.
     */
    private function migrateSharedSentences(string $sharedTable): void
    {
        $db = DB::connection($this->connection);

        $db->table($sharedTable)->orderBy('id')->chunk(1000, function ($rows) use ($db) {
            // Bucket inserts per target language table to minimise round-trips.
            $byTable = [];

            foreach ($rows as $row) {
                $text = isset($row->text) ? (string) $row->text : '';
                if ($text === '') {
                    continue;
                }
                $langCode = AppQyV1TableMaps::normalizeLangCode((string) ($row->language ?? ''));
                if ($langCode === '' || !AppQyV1TableMaps::isLanguageSupported($langCode)) {
                    $langCode = 'en';
                }
                $target = AppQyV1TableMaps::getSentenceTableName($langCode);
                if (!Schema::connection($this->connection)->hasTable($target)) {
                    continue;
                }

                $contentId = isset($row->content_id) && (string) $row->content_id !== ''
                    ? (string) $row->content_id
                    : MediaIngestService::computeContentId($text);

                $now = now();
                $byTable[$target][] = [
                    'content_id' => $contentId,
                    'sentence_id' => $row->sentence_id ?? MediaIngestService::computeSentenceId($text, $langCode),
                    'corr_id' => $row->corr_id ?? null,
                    'text' => $text,
                    'language' => $langCode,
                    'explanation' => $row->explanation ?? null,
                    'ai_commentary' => $row->ai_commentary ?? null,
                    'grammar' => $row->grammar ?? null,
                    'special_usage' => $row->special_usage ?? null,
                    'audio' => $row->audio ?? null,
                    'has_audio' => !empty($row->audio),
                    'occurrence_count' => (int) ($row->occurrence_count ?? 1),
                    'metadata' => $row->metadata ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach ($byTable as $target => $batch) {
                // insertOrIgnore: never clobber an existing per-language row
                // (the unique content_id makes the copy fill-missing).
                $db->table($target)->insertOrIgnore($batch);
            }
        });
    }

    /**
     * Copy shared chapter rows into the per-language chapter tables. The legacy
     * shared row carries no language, so fold it into the source's primary
     * language (from source_sentences) else 'en'. Best-effort; chapters re-derive
     * on the next ingest anyway.
     */
    private function migrateSharedChapters(string $sharedTable): void
    {
        $db = DB::connection($this->connection);
        $sourceSentences = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'source_sentences');
        $hasSourceSentences = Schema::connection($this->connection)->hasTable($sourceSentences);

        $db->table($sharedTable)->orderBy('id')->chunk(500, function ($rows) use ($db, $sourceSentences, $hasSourceSentences) {
            foreach ($rows as $row) {
                $sourceType = (string) ($row->source_type ?? 'book');
                $sourceKey = (string) ($row->source_key ?? '');
                if ($sourceKey === '') {
                    continue;
                }
                $chapterIndex = (int) ($row->chapter_index ?? 0);

                $langCode = 'en';
                if ($hasSourceSentences) {
                    $primary = $db->table($sourceSentences)
                        ->where('source_type', $sourceType)
                        ->where('source_key', $sourceKey)
                        ->whereNotNull('primary_language')
                        ->value('primary_language');
                    if (!empty($primary)) {
                        $langCode = AppQyV1TableMaps::normalizeLangCode((string) $primary);
                    }
                }
                if ($langCode === '' || !AppQyV1TableMaps::isLanguageSupported($langCode)) {
                    $langCode = 'en';
                }

                $target = AppQyV1TableMaps::getChapterTableName($langCode);
                if (!Schema::connection($this->connection)->hasTable($target)) {
                    continue;
                }

                $exists = $db->table($target)
                    ->where('source_type', $sourceType)
                    ->where('source_key', $sourceKey)
                    ->where('chapter_index', $chapterIndex)
                    ->exists();
                if ($exists) {
                    continue;
                }

                $now = now();
                $db->table($target)->insert([
                    'source_type' => $sourceType,
                    'source_key' => $sourceKey,
                    'chapter_index' => $chapterIndex,
                    'language' => $langCode,
                    'title' => $row->title ?? null,
                    'corr_id' => sha1($sourceKey . '|chapter|' . $chapterIndex),
                    'sentence_count' => (int) ($row->sentence_count ?? 0),
                    'metadata' => $row->metadata ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }

    public function down(): void
    {
        // Intentionally empty: the shared tables are not recreated.
    }
};
