<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Media Ingest Tables Initializer (Books v3.1 unified per-language model).
 *
 * Creates / aligns the media ingestion tables for AppQyV1:
 *   - app_qy_v1_subtitles          (字幕/movie sources)
 *   - app_qy_v1_books              (书籍 sources)
 *   - app_qy_v1_source_sentences   (language-independent positional slot)
 *   - app_qy_v1_media_segments     (subtitle audio+video clip segments)
 *   - app_qy_v1_sentences_{lang}   (per-language authoritative sentence store)
 *   - app_qy_v1_chapters_{lang}    (per-language chapter store)
 *
 * The single shared {prefix}_sentences and {prefix}_chapters tables are REMOVED
 * (§3.4) and are no longer created here. Idempotent: uses
 * SafeMigrationHelper::alignTableStructureFromArray, so re-running sys:init only
 * ADDS missing columns/indexes and NEVER drops data.
 */
class MediaIngestTablesInitializer
{
    /**
     * Create / align all media ingest tables (incl. the full per-language set).
     *
     * @return array [tableName => 'created'|'updated'|'aligned'|'error: ...']
     */
    public static function ensureTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);

        // [fullyQualifiedTableName => structure]. The base tables are resolved
        // from their bare suffix; the per-language tables are already qualified.
        $tables = [
            AppTablePrefixServiceProvider::buildTableName($appKey, 'subtitles') => self::subtitlesStructure(),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'books') => self::booksStructure(),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'source_sentences') => self::sourceSentencesStructure(),
            AppTablePrefixServiceProvider::buildTableName($appKey, 'media_segments') => self::segmentsStructure(),
        ];

        // Per-language sentence + chapter tables (one each per supported lang).
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $tables[AppQyV1TableMaps::getSentenceTableName($lang)] = self::sentenceLangStructure($lang);
            $tables[AppQyV1TableMaps::getChapterTableName($lang)] = self::chapterLangStructure($lang);
        }

        foreach ($tables as $tableName => $structure) {
            try {
                $result = SafeMigrationHelper::alignTableStructureFromArray(
                    $connection,
                    $tableName,
                    $structure,
                    [
                        'shrink_columns' => false,
                        'modify_columns' => true,
                        'add_indexes' => true,
                    ]
                );
                $results[$tableName] = $result['status'] ?? 'aligned';
            } catch (\Exception $e) {
                $results[$tableName] = 'error: ' . $e->getMessage();
            }
        }

        return $results;
    }

    /**
     * Table statistics for the sys:init report.
     */
    public static function getTableStats(): array
    {
        try {
            $appKey = AppKeys::APPQYV1;
            $connection = AppTablePrefixServiceProvider::getConnection($appKey);
            $db = \Illuminate\Support\Facades\DB::connection($connection);

            $suffixes = [
                'subtitles' => 'subtitles',
                'books' => 'books',
                'source_sentences' => 'source_sentences',
                'segments' => 'media_segments',
            ];

            $stats = [];
            foreach ($suffixes as $label => $suffix) {
                $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, $suffix);
                $stats[$label] = Schema::connection($connection)->hasTable($tableName)
                    ? $db->table($tableName)->count()
                    : 0;
            }

            // Per-language sentence + chapter totals (Books v3.1).
            $sentenceTotal = 0;
            $chapterTotal = 0;
            foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
                $sTable = AppQyV1TableMaps::getSentenceTableName($lang);
                if (Schema::connection($connection)->hasTable($sTable)) {
                    $sentenceTotal += $db->table($sTable)->count();
                }
                $cTable = AppQyV1TableMaps::getChapterTableName($lang);
                if (Schema::connection($connection)->hasTable($cTable)) {
                    $chapterTotal += $db->table($cTable)->count();
                }
            }
            $stats['sentences'] = $sentenceTotal;
            $stats['chapters'] = $chapterTotal;

            return $stats;
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Per-language authoritative sentence store {prefix}_sentences_{lang}
     * (Books v3.1 §3.1). Deduped on content_id within the table; all language
     * values are codes. Mirrors the per-language sentences migration.
     */
    private static function sentenceLangStructure(string $lang): array
    {
        $idxHash = substr(md5(AppQyV1TableMaps::getSentenceTableName($lang)), 0, 16);
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'content_id' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'unique' => true, 'comment' => 'md5(normalize(strip_punctuation(text))); language-agnostic, unique here'],
                'sentence_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'sha1(normalize(text) . | . lang) legacy compat key'],
                'corr_id' => ['type' => 'string', 'length' => 40, 'nullable' => true, 'index' => true, 'comment' => 'cross-language correspondence group id'],
                'text' => ['type' => 'text', 'nullable' => false, 'comment' => 'original case, punctuation-stripped + normalized'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'lang code (== table suffix)'],
                'explanation' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI enrich-only'],
                'ai_commentary' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI enrich-only'],
                'grammar' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI enrich-only'],
                'special_usage' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI enrich-only'],
                'audio' => ['type' => 'string', 'nullable' => true, 'comment' => 'relative path cache {lang}/{content_id}.mp3'],
                'has_audio' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'index' => true, 'comment' => 'DB flag only; disk is truth'],
                'occurrence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 1, 'comment' => 'times ingested'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'tts_status' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'index' => true],
                'tts_attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'tts_error' => ['type' => 'text', 'nullable' => true],
                'tts_locked_at' => ['type' => 'dateTime', 'nullable' => true, 'index' => true],
                'tts_locked_by' => ['type' => 'string', 'length' => 100, 'nullable' => true],
                'tts_priority' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'index' => true],
                'tts_requested_at' => ['type' => 'dateTime', 'nullable' => true],
                'tts_completed_at' => ['type' => 'dateTime', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['content_id'], 'unique' => true, 'name' => 'uniq_sent_cid_' . $idxHash],
                ['columns' => ['sentence_id']],
                ['columns' => ['language']],
                ['columns' => ['has_audio']],
            ],
        ];
    }

    /**
     * Per-language chapter store {prefix}_chapters_{lang} (Books v3.1 §3.2).
     * Unique on (source_type, source_key, chapter_index); language is a code.
     */
    private static function chapterLangStructure(string $lang): array
    {
        $idxHash = substr(md5(AppQyV1TableMaps::getChapterTableName($lang)), 0, 16);
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'book', 'index' => true, 'comment' => 'book|subtitle|document|article'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'FK to books/subtitles source_key'],
                'chapter_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => '0-based order'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'lang code (== table suffix)'],
                'title' => ['type' => 'string', 'nullable' => true, 'comment' => 'chapter title in this language; null where 留空'],
                'corr_id' => ['type' => 'string', 'length' => 40, 'nullable' => true, 'index' => true, 'comment' => 'sha1(source_key . |chapter| . chapter_index)'],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_type']],
                ['columns' => ['source_key']],
                ['columns' => ['source_type', 'source_key', 'chapter_index'], 'unique' => true, 'name' => 'uniq_chap_pos_' . $idxHash],
            ],
        ];
    }

    /**
     * Subtitle (movie) sources. Has audio+video clip segments.
     * Mirrors AppQyV1_2026_06_08_000004_create_app_qy_v1_subtitles_table.php
     */
    private static function subtitlesStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Stable hash of the source abs path (pycore)'],
                'title' => ['type' => 'string', 'nullable' => true, 'comment' => 'Media title'],
                'original_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Source original basename (mapping filename.original)'],
                'ascii_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Transcoded ASCII stem (mapping filename.ascii)'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'index' => true, 'comment' => 'Primary language'],
                'duration_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Total duration in seconds'],
                'rel_path' => ['type' => 'text', 'nullable' => true, 'comment' => 'Relative source path'],
                'output_dir' => ['type' => 'text', 'nullable' => true, 'comment' => 'Output directory used by worker'],
                'full_content' => ['type' => 'longText', 'nullable' => true, 'comment' => 'Complete .srt backup'],
                'files' => ['type' => 'json', 'nullable' => true, 'comment' => 'Whole-file outputs {full_mp4, tiny_mp4, mp3, srt} (basenames in output dir)'],
                'subtitle_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of subtitle entries'],
                'segment_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of segments'],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of sentences'],
                // Mirrors AppQyV1_2026_06_19_000005_add_selected_languages_to_subtitles.php — the
                // checked correspondence language codes (JSON array). Without this, sys:init builds
                // the table missing the column and every ingest INSERT fails with PG 42703.
                'selected_languages' => ['type' => 'json', 'nullable' => true, 'comment' => 'Checked correspondence language codes'],
                'synced_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Last sync timestamp'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                // Movie/TV poster — mirrors AppQyV1_2026_06_15_000001_add_poster_columns_to_media_tables.php
                // (MOVIE_POSTER_PIPELINE.md §5). Without these, a sys:init-built table drifts from the migrations.
                'poster_filename' => ['type' => 'string', 'length' => 255, 'nullable' => true, 'comment' => 'Local poster filename under static/app_qy_v1/posters'],
                'poster_provider' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'comment' => 'Poster provider: tmdb | omdb | ai'],
                'poster_source_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Provider result id, e.g. tmdb:movie:603 | imdb:tt0133093'],
                'poster_status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'pending', 'comment' => 'Poster lifecycle: pending|ready|failed|none'],
                'poster_meta' => ['type' => 'json', 'nullable' => true, 'comment' => 'Provider meta: year, original_title, overview, poster_url'],
                'poster_fetched_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'When the poster was last fetched/stored'],
                // Poster assist lease — mirrors AppQyV1_2026_06_15_000002_add_assist_lease_columns_to_media_tables.php.
                'assist_claimed_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Poster assist lease start (60-minute lease)'],
                'assist_claimed_by' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Assist claimer identity (e.g. pycore worker id)'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key'], 'unique' => true],
                ['columns' => ['language']],
                // Same name the migration uses → safeAddIndex is idempotent-by-name (no duplicate).
                ['columns' => ['assist_claimed_at'], 'name' => 'idx_subtitles_assist_claimed_at'],
            ],
        ];
    }

    /**
     * Book sources. Maps sentences + audio only, NO video.
     * Mirrors AppQyV1_2026_06_08_000005_create_app_qy_v1_books_table.php
     */
    private static function booksStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Stable hash of the source abs path (pycore)'],
                'content_id' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'unique' => true, 'comment' => 'v2 dedup key = md5(normalize(strip_punctuation(full_content)))'],
                'title' => ['type' => 'string', 'nullable' => true, 'comment' => 'Book title'],
                'original_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Source original basename (mapping filename.original)'],
                'ascii_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Transcoded ASCII stem (mapping filename.ascii)'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'index' => true, 'comment' => 'Primary language'],
                'full_content' => ['type' => 'longText', 'nullable' => true, 'comment' => 'Complete book backup'],
                'audio' => ['type' => 'json', 'nullable' => true, 'comment' => 'Book audio reference(s); books have no video'],
                'sentence_seq' => ['type' => 'json', 'nullable' => true, 'comment' => 'Ordered reconstruction sequence: sentence content-ids interleaved with marker codes'],
                'word_ids' => ['type' => 'json', 'nullable' => true, 'comment' => 'Distinct word md5s per language { lang: [md5,...] }'],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of sentences'],
                'synced_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Last sync timestamp'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                // Movie/TV poster — mirrors AppQyV1_2026_06_15_000001_add_poster_columns_to_media_tables.php
                // (poster columns are added to BOTH the books and subtitles media tables).
                'poster_filename' => ['type' => 'string', 'length' => 255, 'nullable' => true, 'comment' => 'Local poster filename under static/app_qy_v1/posters'],
                'poster_provider' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'comment' => 'Poster provider: tmdb | omdb | ai'],
                'poster_source_id' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Provider result id, e.g. tmdb:movie:603 | imdb:tt0133093'],
                'poster_status' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'pending', 'comment' => 'Poster lifecycle: pending|ready|failed|none'],
                'poster_meta' => ['type' => 'json', 'nullable' => true, 'comment' => 'Provider meta: year, original_title, overview, poster_url'],
                'poster_fetched_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'When the poster was last fetched/stored'],
                // Poster assist lease — mirrors AppQyV1_2026_06_15_000002_add_assist_lease_columns_to_media_tables.php.
                'assist_claimed_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Poster assist lease start (60-minute lease)'],
                'assist_claimed_by' => ['type' => 'string', 'length' => 64, 'nullable' => true, 'comment' => 'Assist claimer identity (e.g. pycore worker id)'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key'], 'unique' => true],
                ['columns' => ['content_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_books_content_id'],
                ['columns' => ['language']],
                // Same name the migration uses → safeAddIndex is idempotent-by-name (no duplicate).
                ['columns' => ['assist_claimed_at'], 'name' => 'idx_books_assist_claimed_at'],
            ],
        ];
    }

    /**
     * Positional link between a source (book|subtitle|document|article) and the
     * shared per-language sentence library. Stores BOTH grains ('cue'/'sentence').
     * Mirrors AppQyV1_2026_06_08_000006_create_app_qy_v1_source_sentences_table.php
     */
    private static function sourceSentencesStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'subtitle', 'index' => true, 'comment' => 'book|subtitle|document|article'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'Originating source key'],
                // No sentence_id (Books v3.1 §3.3): the per-language link is carried
                // by lang_content_ids (content_id refs into sentences_{lang}).
                'grain' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'cue', 'comment' => 'cue (1 srt cue) | sentence (merged real sentence)'],
                'seq' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Order within source for that grain'],
                'seg_index' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Subtitle cue video segment index'],
                'sub_idx' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Srt cue index'],
                'start_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Start time in seconds'],
                'end_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'End time in seconds'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                // Books v3.1 correspondence anchor (§3.3).
                'chapter_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'index' => true, 'comment' => 'which chapter this slot belongs to'],
                'corr_id' => ['type' => 'string', 'length' => 40, 'nullable' => true, 'index' => true, 'comment' => 'correspondence group id for this slot'],
                'primary_language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'comment' => "the source's primary language code"],
                'lang_content_ids' => ['type' => 'json', 'nullable' => true, 'comment' => '{code: content_id|null} per selected language'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_type']],
                ['columns' => ['source_key']],
                ['columns' => ['source_type', 'source_key', 'grain', 'seq'], 'unique' => true, 'name' => 'uniq_source_sentence_pos'],
            ],
        ];
    }

    /**
     * Subtitle audio+video clip segments.
     * Mirrors AppQyV1_2026_06_08_000002_create_app_qy_v1_media_segments_table.php
     */
    private static function segmentsStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'FK to subtitles.source_key'],
                'seg_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Segment ordinal index'],
                'start_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Segment start time in seconds'],
                'end_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Segment end time in seconds'],
                'mp4' => ['type' => 'string', 'nullable' => true, 'comment' => 'Clip mp4 filename (2x2 clip)'],
                'full_mp4' => ['type' => 'string', 'nullable' => true, 'comment' => 'Compressed full-resolution clip filename'],
                'mp3' => ['type' => 'string', 'nullable' => true, 'comment' => 'Clip mp3 filename'],
                'sub_idx_start' => ['type' => 'integer', 'nullable' => true, 'comment' => 'First subtitle index in segment'],
                'sub_idx_end' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Last subtitle index in segment'],
                'subtitle_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Subtitle entries in segment'],
                'clip_status' => ['type' => 'json', 'nullable' => true, 'comment' => 'Which clips are present (mp4/mp3)'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key']],
                ['columns' => ['source_key', 'seg_index'], 'unique' => true, 'name' => 'uniq_media_seg_source_idx'],
            ],
        ];
    }
}
