<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PunctuationMarkerModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;

/**
 * Punctuation Marker Seeder (Books Sentence/Word Model v2).
 *
 * Seeds the canonical punctuation-marker set into app_qy_v1_punctuation_markers
 * idempotently at sys:init. The single source of truth is
 * pycore/pyfoundations/punctuation_markers.py (the `_MARKERS` list); the rows
 * below mirror it EXACTLY (codes / chars / types / categories / terminal flags).
 * Kept in sync via pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md §8.
 *
 * Idempotency: upsert keyed on `code` (update-or-create) - never clobbers, safe
 * to re-run. Bump MARKERS_VERSION here whenever _MARKERS changes upstream.
 */
class PunctuationMarkerSeeder
{
    /**
     * Schema version - mirrors punctuation_markers.py MARKERS_VERSION. Bump
     * when the canonical _MARKERS set changes so a re-seed is meaningful.
     */
    public const MARKERS_VERSION = 1;

    /**
     * Canonical marker rows - EXACT mirror of punctuation_markers.py _MARKERS.
     *   category: 'terminal' (ends a sentence) | 'pause' | 'structure'
     *   terminal: whether it closes a sentence (drives book segmentation)
     *
     * @return array<int, array{code:string, char:string, type:string, category:string, terminal:bool}>
     */
    public static function markers(): array
    {
        return [
            // --- sentence terminals (Latin + full-width CJK) ---------------------- //
            ['code' => 'period',       'char' => '.',    'type' => 'period',      'category' => 'terminal',  'terminal' => true],
            ['code' => 'period_fw',    'char' => '。',   'type' => 'period',      'category' => 'terminal',  'terminal' => true],
            ['code' => 'excl',         'char' => '!',    'type' => 'exclamation', 'category' => 'terminal',  'terminal' => true],
            ['code' => 'excl_fw',      'char' => '！',   'type' => 'exclamation', 'category' => 'terminal',  'terminal' => true],
            ['code' => 'ques',         'char' => '?',    'type' => 'question',    'category' => 'terminal',  'terminal' => true],
            ['code' => 'ques_fw',      'char' => '？',   'type' => 'question',    'category' => 'terminal',  'terminal' => true],
            ['code' => 'ellipsis',     'char' => '…',    'type' => 'ellipsis',    'category' => 'terminal',  'terminal' => true],
            ['code' => 'semicolon_fw', 'char' => '；',   'type' => 'semicolon',   'category' => 'terminal',  'terminal' => true],
            // --- intra-sentence pauses (kept for richer reconstruction; non-terminal) //
            ['code' => 'comma',        'char' => ',',    'type' => 'comma',       'category' => 'pause',     'terminal' => false],
            ['code' => 'comma_fw',     'char' => '，',   'type' => 'comma',       'category' => 'pause',     'terminal' => false],
            ['code' => 'enum_fw',      'char' => '、',   'type' => 'enumeration', 'category' => 'pause',     'terminal' => false],
            ['code' => 'semicolon',    'char' => ';',    'type' => 'semicolon',   'category' => 'pause',     'terminal' => false],
            ['code' => 'colon',        'char' => ':',    'type' => 'colon',       'category' => 'pause',     'terminal' => false],
            ['code' => 'colon_fw',     'char' => '：',   'type' => 'colon',       'category' => 'pause',     'terminal' => false],
            // --- structure -------------------------------------------------------- //
            ['code' => 'newline',      'char' => "\n",   'type' => 'newline',     'category' => 'structure', 'terminal' => false],
            ['code' => 'paragraph',    'char' => "\n\n", 'type' => 'paragraph',   'category' => 'structure', 'terminal' => false],
        ];
    }

    /**
     * Ensure the table exists and upsert the canonical markers keyed on `code`.
     *
     * Fill behaviour: never clobber. An existing row is updated only when one of
     * its canonical fields (char/type/category/terminal) has drifted from the
     * source of truth; otherwise it is left untouched. New codes are inserted.
     *
     * @return array ['table' => string, 'created' => int, 'updated' => int, 'unchanged' => int]
     */
    public static function seed(): array
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'punctuation_markers');

        // Idempotent table guard (mirrors the migration; safe under bare sys:init
        // re-runs even if the migration repository was reset).
        SafeMigrationHelper::alignTableStructureFromArray(
            $connection,
            $tableName,
            self::tableStructure(),
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );

        $counts = AppQyV1PunctuationMarkerModel::synchronizeMarkers(self::markers());

        return [
            'table' => $tableName,
            'created' => $counts['created'],
            'updated' => $counts['updated'],
            'unchanged' => $counts['unchanged'],
        ];
    }

    /**
     * Table statistics for the sys:init report.
     */
    public static function getTableStats(): array
    {
        try {
            return ['markers' => AppQyV1PunctuationMarkerModel::tableRowCount()];
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Canonical table structure (mirrors the v2 migration).
     */
    private static function tableStructure(): array
    {
        return [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'code' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'unique' => true, 'comment' => 'Stable marker slug (matches punctuation_markers.py _MARKERS code)'],
                'char' => ['type' => 'string', 'length' => 8, 'nullable' => false, 'comment' => 'Exact glyph this marker represents'],
                'type' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'comment' => 'Marker type (period|comma|...)'],
                'category' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'terminal|pause|structure'],
                'terminal' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'comment' => 'Whether it closes a sentence (drives book segmentation)'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['code'], 'unique' => true],
                ['columns' => ['category']],
            ],
        ];
    }
}
