<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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

    public const app_qy_v1_VOCABULARY_COLLECTIONS = [
        'tablename' => 'vocabulary_collections',
        'fields' => [
            'id' => 'id',
            'collection_name' => 'collection_name',
            'lang_code' => 'lang_code',
            'source_type' => 'source_type',
            'owner_id' => 'owner_id',
            'is_public' => 'is_public',
            'description' => 'description',
            'total_words' => 'total_words',
            'meta_data' => 'meta_data',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_VOCABULARY_ITEMS = [
        'tablename' => 'vocabulary_items',
        'fields' => [
            'id' => 'id',
            'collection_id' => 'collection_id',
            'lang_code' => 'lang_code',
            'word_content' => 'word_content',
            'word_md5' => 'word_md5',
            'word_index' => 'word_index',
            'extra_data' => 'extra_data',
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
     * @return array Array of [langCode => tableName]
     */
    public static function getAllWordTables(): array
    {
        return [
            'en' => self::getDictionaryTableName('en'),
            'ja' => self::getDictionaryTableName('ja'),
            'vi' => self::getDictionaryTableName('vi'),
            'lo' => self::getDictionaryTableName('lo'),
        ];
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
            "{$prefix}_WORD_GROUPS",
            "{$prefix}_VOCABULARY_COLLECTIONS",
            "{$prefix}_VOCABULARY_ITEMS",
            "{$prefix}_USER_LEARNING_PROGRESS",
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

