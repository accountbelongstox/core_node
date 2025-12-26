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

class AppQyV1TableMaps
{
    /**
     * AppQyV1 Application Database Table Mappings
     * This class provides centralized table name and field mappings for the AppQyV1 application
     * All database operations should reference these mappings instead of hardcoded table/field names
     */
    
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
        'tablename' => 'app_qy_v1_dictionaries',
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
        'tablename' => 'app_qy_v1_personal_dictionaries',
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
        'tablename' => 'app_qy_v1_word_groups',
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
        'tablename' => 'app_qy_v1_vocabulary_collections',
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
        'tablename' => 'app_qy_v1_vocabulary_items',
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
        'tablename' => 'app_qy_v1_user_learning_progress',
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
        'tablename' => 'app_qy_v1_user_selected_libraries',
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
     */
    public static function getTableName(string $tableKey): string
    {
        if (preg_match('/^app_qy_v1_([a-z]{2,3})_DICTIONARIES$/i', $tableKey, $matches)) {
            $langCode = strtolower($matches[1]);
            if (in_array($langCode, self::getSupportedLanguageCodes())) {
                return "app_qy_v1_{$langCode}_dictionaries";
            }
        }

        if (defined("self::{$tableKey}")) {
            return constant("self::{$tableKey}")['tablename'];
        }
        return '';
    }
    
    public static function getWordTableName(string $langCode): string
    {
        $langCode = strtolower($langCode);

        $languageMapping = [
            'en' => 'english',
            'ja' => 'japanese',
            'ko' => 'korean',
            'vi' => 'vietnamese',
            'lo' => 'lao',
            'english' => 'english',
            'japanese' => 'japanese',
            'korean' => 'korean',
            'vietnamese' => 'vietnamese',
            'lao' => 'lao',
        ];

        $mappedName = $languageMapping[$langCode] ?? $langCode;
        return "app_qy_v1_words_{$mappedName}";
    }

    /**
     * Get all available word tables
     *
     * @return array Array of [langCode => tableName]
     */
    public static function getAllWordTables(): array
    {
        return [
            'en' => 'app_qy_v1_words_english',
            'ja' => 'app_qy_v1_words_japanese',
            'vi' => 'app_qy_v1_words_vietnamese',
            'lo' => 'app_qy_v1_words_lao',
        ];
    }

    public static function getDictionaryTableName(string $langCode): string
    {
        $langCode = strtolower($langCode);
        return "app_qy_v1_tts_cache_{$langCode}";
    }

    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        if (preg_match('/^app_qy_v1_([a-z]{2,3})_DICTIONARIES$/i', $tableKey, $matches)) {
            $langCode = strtolower($matches[1]);
            if (in_array($langCode, self::getSupportedLanguageCodes())) {
                return self::DICTIONARY_FIELDS[$fieldKey] ?? $fieldKey;
            }
        }

        if (defined("self::{$tableKey}")) {
            $tableMap = constant("self::{$tableKey}");
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
        if (defined("self::{$tableKey}")) {
            return constant("self::{$tableKey}")['fields'];
        }
        return [];
    }

    public static function getAvailableTableKeys(): array
    {
        $keys = [
            'app_qy_v1_DICTIONARIES',
            'app_qy_v1_PERSONAL_DICTIONARIES',
            'app_qy_v1_WORD_GROUPS',
            'app_qy_v1_VOCABULARY_COLLECTIONS',
            'app_qy_v1_VOCABULARY_ITEMS',
            'app_qy_v1_USER_LEARNING_PROGRESS',
            'app_qy_v1_USER_SELECTED_LIBRARIES'
        ];

        foreach (self::getSupportedLanguageCodes() as $langCode) {
            $keys[] = "app_qy_v1_{$langCode}_TTS_CACHE";
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

