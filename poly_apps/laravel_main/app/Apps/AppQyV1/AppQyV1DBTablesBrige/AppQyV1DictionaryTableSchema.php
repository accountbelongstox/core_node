<?php

namespace App\Apps\AppQyV1\AppQyV1DBTablesBrige;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Services\SafeMigrationHelper;

/**
 * The one schema of the per-language dictionary tables: {prefix}_tts_cache_{lang}
 * (formal) and {prefix}_tts_cache_{lang}_staging (Stage-1 import target).
 *
 * Used by the creating migration and by every sys:init alignment. Add-only:
 * missing tables, columns and indexes are created; nothing is dropped or
 * modified, so populated tables keep their data.
 */
final class AppQyV1DictionaryTableSchema
{
    private const ALIGN_OPTIONS = ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true];

    /** Columns shared by the formal and staging tables (md5 is per table). */
    private const BASE_COLUMNS = [
        'id' => ['type' => 'bigIncrements'],
        'content' => ['type' => 'text'],
        'translations' => ['type' => 'text', 'nullable' => true],
        'has_translation' => ['type' => 'boolean', 'default' => false],
        'translation_provider' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'phonetic' => ['type' => 'text', 'nullable' => true],
        'us_phonetic' => ['type' => 'text', 'nullable' => true],
        'uk_phonetic' => ['type' => 'text', 'nullable' => true],
        'tts_files' => ['type' => 'text', 'nullable' => true],
        'tts_provider' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'has_audio' => ['type' => 'boolean', 'default' => false],
        'image_files' => ['type' => 'text', 'nullable' => true],
        'image_provider' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'word_details' => ['type' => 'text', 'nullable' => true],
        'is_exist_local' => ['type' => 'boolean', 'default' => false],
        'has_operations' => ['type' => 'boolean', 'default' => false],
        'is_valid' => ['type' => 'boolean', 'default' => true],
        'validity_checked_at' => ['type' => 'dateTime', 'nullable' => true],
        'validity_source' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'validity_note' => ['type' => 'text', 'nullable' => true],
        'query_count' => ['type' => 'integer', 'default' => 0],
        'last_modified' => ['type' => 'dateTime', 'nullable' => true],
        'last_query_time' => ['type' => 'dateTime', 'nullable' => true],
        'created_at' => ['type' => 'timestamp', 'nullable' => true],
        'updated_at' => ['type' => 'timestamp', 'nullable' => true],
    ];

    /** Formal-only columns: multi-variant audio, generation state, image state, bing resources, global-task links. */
    private const FORMAL_COLUMNS = [
        'audio_files' => ['type' => 'json', 'nullable' => true],
        'tts_status' => ['type' => 'string', 'length' => 20, 'nullable' => true],
        'tts_attempts' => ['type' => 'integer', 'default' => 0],
        'tts_error' => ['type' => 'text', 'nullable' => true],
        'tts_locked_at' => ['type' => 'dateTime', 'nullable' => true],
        'tts_locked_by' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'tts_priority' => ['type' => 'integer', 'default' => 0],
        'tts_requested_at' => ['type' => 'dateTime', 'nullable' => true],
        'tts_completed_at' => ['type' => 'dateTime', 'nullable' => true],
        // Work lease of the gap row (config/queue_center_contract.json work_leases).
        'tts_lease_id' => ['type' => 'string', 'length' => 32, 'nullable' => true],
        'tts_lease_expires_at' => ['type' => 'dateTime', 'nullable' => true],
        'image_status' => ['type' => 'string', 'length' => 20, 'nullable' => true],
        'image_priority' => ['type' => 'integer', 'default' => 0],
        'image_locked_at' => ['type' => 'dateTime', 'nullable' => true],
        'image_locked_by' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'image_attempts' => ['type' => 'integer', 'default' => 0],
        'image_requested_at' => ['type' => 'dateTime', 'nullable' => true],
        'image_completed_at' => ['type' => 'dateTime', 'nullable' => true],
        'bing_resource_urls' => ['type' => 'text', 'nullable' => true],
        'tts_global_task_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
        'image_global_task_id' => ['type' => 'string', 'length' => 64, 'nullable' => true],
        'image_mcp_submitted_at' => ['type' => 'timestamp', 'nullable' => true],
    ];

    private const FORMAL_INDEXES = [
        ['columns' => ['content']],
        ['columns' => ['query_count']],
        ['columns' => ['has_translation']],
        ['columns' => ['has_audio']],
        ['columns' => ['is_valid']],
        ['columns' => ['tts_status']],
        ['columns' => ['tts_locked_at']],
        ['columns' => ['tts_priority']],
        ['columns' => ['image_status']],
        ['columns' => ['image_priority']],
        ['columns' => ['tts_global_task_id']],
        ['columns' => ['image_global_task_id']],
    ];

    /**
     * Ensures one language's formal and staging tables, then the gap indexes.
     *
     * @return array<string,string> table => align status (created|updated|aligned|error)
     */
    public static function ensure(string $connection, string $language): array
    {
        $formal = AppQyV1TableMaps::getDictionaryTableName($language);
        $staging = AppQyV1TableMaps::getDictionaryStagingTableName($language);
        $results = [
            $formal => SafeMigrationHelper::alignTableStructureFromArray($connection, $formal, self::formalStructure(), self::ALIGN_OPTIONS)['status'] ?? 'error',
            // Staging md5 is a plain index: an import may carry duplicates; promotion dedups.
            $staging => SafeMigrationHelper::alignTableStructureFromArray($connection, $staging, self::stagingStructure(), self::ALIGN_OPTIONS)['status'] ?? 'error',
        ];

        AppQyV1MediaGaps::ensureWordIndexes($connection, $language);

        return $results;
    }

    private static function formalStructure(): array
    {
        return [
            'columns' => self::withMd5(self::BASE_COLUMNS, ['unique' => true]) + self::FORMAL_COLUMNS,
            'indexes' => self::FORMAL_INDEXES,
        ];
    }

    private static function stagingStructure(): array
    {
        return [
            'columns' => self::withMd5(self::BASE_COLUMNS, ['index' => true]),
            'indexes' => [['columns' => ['content']]],
        ];
    }

    private static function withMd5(array $columns, array $keyKind): array
    {
        return array_slice($columns, 0, 2, true)
            + ['md5' => ['type' => 'string', 'length' => 32] + $keyKind]
            + array_slice($columns, 2, null, true);
    }

    private function __construct()
    {
    }
}
