<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1DBTablesBrige;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1TableMaps
{
    /**
     * AppQyV1 Application Database Table Mappings
     * This class provides centralized table name and field mappings for the AppQyV1 application
     * All database operations should reference these mappings instead of hardcoded table/field names
     */
    
    /**
     * Get table prefix from key center
     */
    private static function getTablePrefix(): string
    {
        static $prefix = null;
        if ($prefix === null) {
            $appKey = AppKeys::APPQYV1;
            $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        }
        return $prefix;
    }
    
    private static function getSupportedLanguageCodes(): array
    {
        static $langCodes = null;
        if ($langCodes === null) {
            $langCodes = array_keys(config('edge_tts.lang_code_mapping', []));
        }
        return $langCodes;
    }

    private const DICTIONARY_FIELDS = [
        'id' => 'id',
        'content' => 'content',
        'md5' => 'md5',
        'translations' => 'translations',
        'has_translation' => 'has_translation',
        'translation_provider' => 'translation_provider',
        'phonetic' => 'phonetic',
        'us_phonetic' => 'us_phonetic',
        'uk_phonetic' => 'uk_phonetic',
        'tts_files' => 'tts_files',
        'tts_provider' => 'tts_provider',
        'image_files' => 'image_files',
        'image_provider' => 'image_provider',
        'word_details' => 'word_details',
        'is_exist_local' => 'is_exist_local',
        'has_operations' => 'has_operations',
        'query_count' => 'query_count',
        'last_modified' => 'last_modified',
        'last_query_time' => 'last_query_time',
        'created_at' => 'created_at',
        'updated_at' => 'updated_at'
    ];
    
    public const app_qy_v1_DICTIONARIES = [
        'tablename' => 'dictionaries',
        'fields' => [
            'id' => 'id',
            'content' => 'content',
            'md5' => 'md5',
            'translation' => 'translation',
            'isTranslation' => 'isTranslation',
            'translation_provider' => 'translation_provider',
            'lastModified' => 'lastModified',
            'lastInsertTime' => 'lastInsertTime',
            'lastUpdateTime' => 'lastUpdateTime',
            'lastQueryTime' => 'lastQueryTime',
            'queryCount' => 'queryCount',
            'usPhonetic' => 'usPhonetic',
            'ukPhonetic' => 'ukPhonetic',
            'voice_files' => 'voice_files',
            'image_files' => 'image_files',
            'isExistLocal' => 'isExistLocal',
            'voice_files_provider' => 'voice_files_provider',
            'image_files_provider' => 'image_files_provider',
            'hasOperations' => 'hasOperations',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'createdAt' => 'createdAt'
        ]
    ];

    public const app_qy_v1_PERSONAL_DICTIONARIES = [
        'tablename' => 'personal_dictionaries',
        'fields' => [
            'id' => 'id',
            'uid' => 'uid',
            'personal_dicts' => 'personal_dicts',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_PERSONAL_DICTIONARY_ENTRIES = [
        'tablename' => 'personal_dictionary_entries',
        'fields' => [
            'id' => 'id',
            'uid' => 'uid',
            'word' => 'word',
            'language' => 'language',
            'definition' => 'definition',
            'example' => 'example',
            'notes' => 'notes',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_WORD_GROUPS = [
        'tablename' => 'word_groups',
        'fields' => [
            'id' => 'id',
            'gid' => 'gid',
            'username' => 'username',
            'uid' => 'uid',
            'gname' => 'gname',
            'gcontent' => 'gcontent',
            'gwords' => 'gwords',
            'words_frequency' => 'words_frequency',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    // vocabulary_collections / vocabulary_items were merged into
    // vocabulary_libraries (word_ids of dictionary ids) by the Wave A/B
    // consolidation and dropped by AppQyV1_2026_06_12_150002.

    // group_words / user_word_progress (row-per-word) were merged into
    // group_word_progress (one JSON row per user+group) by the
    // AppQyV1_2026_06_12_16000x migrations and dropped by ..._160002.
    public const app_qy_v1_GROUP_WORD_PROGRESS = [
        'tablename' => 'group_word_progress',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'group_id' => 'group_id',
            'language_code' => 'language_code',
            'words' => 'words',
            'total_words' => 'total_words',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_USER_LEARNING_PROGRESS = [
        'tablename' => 'user_learning_progress',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'lang_code' => 'lang_code',
            'word_md5' => 'word_md5',
            'word_content' => 'word_content',
            'learning_status' => 'learning_status',
            'review_count' => 'review_count',
            'correct_count' => 'correct_count',
            'wrong_count' => 'wrong_count',
            'last_reviewed_at' => 'last_reviewed_at',
            'next_review_at' => 'next_review_at',
            'familiarity_level' => 'familiarity_level',
            'review_history' => 'review_history',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_USER_FOLLOWS = [
        'tablename' => 'user_follows',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'followed_user_id' => 'followed_user_id',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_DAILY_RECITATION_LOGS = [
        'tablename' => 'daily_recitation_logs',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'date' => 'date',
            'word' => 'word',
            'language_code' => 'language_code',
            'action' => 'action',
            'session_id' => 'session_id',
            'batch_id' => 'batch_id',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_USER_SELECTED_LIBRARIES = [
        'tablename' => 'user_selected_libraries',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'collection_id' => 'collection_id',
            'lang_code' => 'lang_code',
            'is_active' => 'is_active',
            'selected_at' => 'selected_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    // Global Tables (referenced from app/Providers)
    // Note: Global tables are managed in App\Providers\GlobalTablesMap
    // Use GlobalTablesMap::getTableName('GLOBAL_USERS') and GlobalTablesMap::getFieldName('GLOBAL_USERS', 'field_key')
    // for accessing global table mappings

    /**
     * Get table name by key
     * Automatically adds prefix from key center if not present
     */
    public static function getTableName(string $tableKey): string
    {
        $prefix = self::getTablePrefix();
        $fullKey = $tableKey;
        $prefixLower = strtolower($prefix);
        if (!str_starts_with(strtolower($tableKey), $prefixLower . '_')) {
            $fullKey = $prefix . '_' . $tableKey;
        }

        if (preg_match('/^' . preg_quote($prefix, '/') . '_([a-z]{2,3})_DICTIONARIES$/i', $fullKey, $matches)) {
            $langCode = strtolower($matches[1]);
            if (in_array($langCode, self::getSupportedLanguageCodes())) {
                // Unified: every dictionary key resolves to the single
                // canonical multi-language table tts_cache_{lang}.
                return self::getDictionaryTableName($langCode);
            }
        }

        if (defined("self::{$fullKey}")) {
            $tableSuffix = constant("self::{$fullKey}")['tablename'];
            return "{$prefix}_{$tableSuffix}";
        }
        return '';
    }
    
    /**
     * Legacy alias. The words_{lang} family is deprecated; every caller now
     * resolves to the single canonical dictionary table tts_cache_{lang}.
     * Language names (english/japanese/...) are normalized to codes.
     */
    public static function getWordTableName(string $langCode): string
    {
        $langCode = strtolower($langCode);

        $nameToCode = [
            'english' => 'en',
            'japanese' => 'ja',
            'korean' => 'ko',
            'vietnamese' => 'vi',
            'lao' => 'lo',
        ];

        if (isset($nameToCode[$langCode])) {
            $langCode = $nameToCode[$langCode];
        }

        return self::getDictionaryTableName($langCode);
    }

    /**
     * Get all canonical dictionary tables (legacy method name kept).
     *
     * Enumerates every supported language code (edge_tts.lang_code_mapping)
     * rather than a hardcoded subset, so the auto-scan can discover a dictionary
     * for ANY language that has data, not just en/ja/vi/lo.
     *
     * @return array Array of [langCode => tableName]
     */
    public static function getAllWordTables(): array
    {
        $tables = [];
        foreach (self::getSupportedLanguageCodes() as $langCode) {
            $tables[$langCode] = self::getDictionaryTableName($langCode);
        }
        return $tables;
    }

    public static function getDictionaryTableName(string $langCode): string
    {
        $prefix = self::getTablePrefix();
        $langCode = strtolower($langCode);
        return "{$prefix}_tts_cache_{$langCode}";
    }

    /**
     * Stage-1 staging table for a language. Import pipelines write here;
     * promoteStagingToFormal() copies into getDictionaryTableName($lang).
     */
    public static function getDictionaryStagingTableName(string $langCode): string
    {
        return self::getDictionaryTableName($langCode) . '_staging';
    }

    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $prefix = self::getTablePrefix();
        $fullKey = $tableKey;
        $prefixLower = strtolower($prefix);
        if (!str_starts_with(strtolower($tableKey), $prefixLower . '_')) {
            $fullKey = $prefix . '_' . $tableKey;
        }

        if (preg_match('/^' . preg_quote($prefix, '/') . '_([a-z]{2,3})_DICTIONARIES$/i', $fullKey, $matches)) {
            $langCode = strtolower($matches[1]);
            if (in_array($langCode, self::getSupportedLanguageCodes())) {
                return self::DICTIONARY_FIELDS[$fieldKey] ?? $fieldKey;
            }
        }

        if (defined("self::{$fullKey}")) {
            $tableMap = constant("self::{$fullKey}");
            return $tableMap['fields'][$fieldKey] ?? $fieldKey;
        }
        return $fieldKey;
    }
    
    public static function getDictionaryFieldName(string $fieldKey): string
    {
        return self::DICTIONARY_FIELDS[$fieldKey] ?? $fieldKey;
    }

    public static function getTableFields(string $tableKey): array
    {
        $prefix = self::getTablePrefix();
        $fullKey = $tableKey;
        $prefixLower = strtolower($prefix);
        if (!str_starts_with(strtolower($tableKey), $prefixLower . '_')) {
            $fullKey = $prefix . '_' . $tableKey;
        }

        if (defined("self::{$fullKey}")) {
            return constant("self::{$fullKey}")['fields'];
        }
        return [];
    }

    public static function getAvailableTableKeys(): array
    {
        $prefix = self::getTablePrefix();
        $keys = [
            "{$prefix}_DICTIONARIES",
            "{$prefix}_PERSONAL_DICTIONARIES",
            "{$prefix}_PERSONAL_DICTIONARY_ENTRIES",
            "{$prefix}_WORD_GROUPS",
            "{$prefix}_GROUP_WORD_PROGRESS",
            "{$prefix}_USER_LEARNING_PROGRESS",
            "{$prefix}_USER_FOLLOWS",
            "{$prefix}_DAILY_RECITATION_LOGS",
            "{$prefix}_USER_SELECTED_LIBRARIES"
        ];

        foreach (self::getSupportedLanguageCodes() as $langCode) {
            $keys[] = "{$prefix}_{$langCode}_TTS_CACHE";
        }

        return $keys;
    }

    public static function getSupportedLanguages(): array
    {
        return self::getSupportedLanguageCodes();
    }

    public static function isLanguageSupported(string $langCode): bool
    {
        return in_array(strtolower($langCode), self::getSupportedLanguageCodes());
    }

    /**
     * Get global table name by key
     * Delegates to GlobalTablesMap for global table access
     */
    public static function getGlobalTableName(string $tableKey): string
    {
        return \App\Providers\GlobalTablesMap::getTableName($tableKey);
    }

    /**
     * Get global field name by table key and field key
     * Delegates to GlobalTablesMap for global table field access
     */
    public static function getGlobalFieldName(string $tableKey, string $fieldKey): string
    {
        return \App\Providers\GlobalTablesMap::getFieldName($tableKey, $fieldKey);
    }

    /**
     * Get all global table fields
     * Delegates to GlobalTablesMap for global table fields access
     */
    public static function getGlobalTableFields(string $tableKey): array
    {
        return \App\Providers\GlobalTablesMap::getTableFields($tableKey);
    }

    /**
     * Check if global table key exists
     * Delegates to GlobalTablesMap for global table key validation
     */
    public static function hasGlobalTableKey(string $tableKey): bool
    {
        return \App\Providers\GlobalTablesMap::hasTableKey($tableKey);
    }
}

