<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;

/**
 * Media Ingest Tables Initializer
 *
 * Creates / aligns the five dedicated media ingestion tables for AppQyV1:
 *   - app_qy_v1_sentences        (SHARED, de-duplicated sentence library)
 *   - app_qy_v1_subtitles        (字幕/movie sources)
 *   - app_qy_v1_books            (书籍 sources)
 *   - app_qy_v1_source_sentences (positional link: source -> shared sentence)
 *   - app_qy_v1_media_segments   (subtitle audio+video clip segments)
 *
 * Idempotent: uses SafeMigrationHelper::alignTableStructureFromArray, so
 * re-running sys:init only ADDS missing columns/indexes and NEVER drops data.
 */
class MediaIngestTablesInitializer
{
    /**
     * Create / align all media ingest tables.
     *
     * @return array [tableName => 'created'|'updated'|'aligned'|'error: ...']
     */
    public static function ensureTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);

        $tables = [
            'sentences' => self::sentencesStructure(),
            'subtitles' => self::subtitlesStructure(),
            'books' => self::booksStructure(),
            'source_sentences' => self::sourceSentencesStructure(),
            'media_segments' => self::segmentsStructure(),
        ];

        foreach ($tables as $suffix => $structure) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, $suffix);
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
                'sentences' => 'sentences',
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

            return $stats;
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * SHARED authoritative sentence library (used by BOTH subtitles and books).
     * Mirrors AppQyV1_2026_06_08_000001_create_app_qy_v1_sentences_table.php
     */
    private static function sentencesStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'sentence_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Dedup key = sha1(normalized_text + | + language)'],
                'content_id' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'unique' => true, 'comment' => 'v2 dedup key = md5(normalize(strip_punctuation(text))); no language'],
                'text' => ['type' => 'text', 'nullable' => false, 'comment' => 'Sentence text (v2: punctuation-stripped, normalized)'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'english', 'index' => true, 'comment' => 'Sentence language'],
                'explanation' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: explanation (enrich-only)'],
                'ai_commentary' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: commentary (enrich-only)'],
                'grammar' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: grammar notes (enrich-only)'],
                'special_usage' => ['type' => 'text', 'nullable' => true, 'comment' => 'AI: special usage (enrich-only)'],
                'audio' => ['type' => 'string', 'nullable' => true, 'comment' => 'Sentence audio reference (enrich-only)'],
                'occurrence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 1, 'comment' => 'Times this sentence has been ingested'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['sentence_id'], 'unique' => true],
                ['columns' => ['content_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_sentences_content_id'],
                ['columns' => ['language']],
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
                'synced_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Last sync timestamp'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key'], 'unique' => true],
                ['columns' => ['language']],
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
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key'], 'unique' => true],
                ['columns' => ['content_id'], 'unique' => true, 'name' => 'uniq_app_qy_v1_books_content_id'],
                ['columns' => ['language']],
            ],
        ];
    }

    /**
     * Positional link between a source (subtitle|book) and the shared sentence
     * library. Stores BOTH grains ('cue' / 'sentence').
     * Mirrors AppQyV1_2026_06_08_000006_create_app_qy_v1_source_sentences_table.php
     */
    private static function sourceSentencesStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'subtitle', 'index' => true, 'comment' => 'subtitle|book'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'Originating source key'],
                'sentence_id' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'FK to sentences.sentence_id'],
                'grain' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'cue', 'comment' => 'cue (1 srt cue) | sentence (merged real sentence)'],
                'seq' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Order within source for that grain'],
                'seg_index' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Subtitle cue video segment index'],
                'sub_idx' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Srt cue index'],
                'start_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Start time in seconds'],
                'end_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'End time in seconds'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_type']],
                ['columns' => ['source_key']],
                ['columns' => ['sentence_id']],
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
