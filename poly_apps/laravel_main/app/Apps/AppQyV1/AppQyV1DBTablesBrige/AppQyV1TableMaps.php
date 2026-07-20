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
    
    // The legacy single `dictionaries` table was removed (superseded by the
    // per-language tts_cache_{lang} tables). The DICTIONARY_FIELDS map above is
    // retained because the `_DICTIONARIES` regex branch in getTableName() /
    // getFieldName() resolves every lang-prefixed dictionary key to tts_cache.

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
            'shuffled_at' => 'shuffled_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_USER_BOOK_READING_PROGRESS = [
        'tablename' => 'user_book_reading_progress',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'source_key' => 'source_key',
            'chapter_index' => 'chapter_index',
            'verse_seq' => 'verse_seq',
            'grain' => 'grain',
            'page' => 'page',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ]
    ];

    public const app_qy_v1_CLIENT_DEVICE_SETTINGS = [
        'tablename' => 'client_device_settings',
        'fields' => [
            'id' => 'id',
            'client_key' => 'client_key',
            'settings' => 'settings',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
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

    // ---- Social subsystem (SOCIAL_FEATURE_SPECIFICATION.md §1) ----

    public const app_qy_v1_FRIEND_REQUESTS = [
        'tablename' => 'friend_requests',
        'fields' => [
            'id' => 'id',
            'requester_id' => 'requester_id',
            'addressee_id' => 'addressee_id',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_CONVERSATIONS = [
        'tablename' => 'conversations',
        'fields' => [
            'id' => 'id',
            'type' => 'type',
            'created_by' => 'created_by',
            'dkey' => 'dkey',
            'last_message_at' => 'last_message_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_CONVERSATION_PARTICIPANTS = [
        'tablename' => 'conversation_participants',
        'fields' => [
            'id' => 'id',
            'conversation_id' => 'conversation_id',
            'user_id' => 'user_id',
            'last_read_message_id' => 'last_read_message_id',
            'joined_at' => 'joined_at'
        ]
    ];

    public const app_qy_v1_MESSAGES = [
        'tablename' => 'messages',
        'fields' => [
            'id' => 'id',
            'conversation_id' => 'conversation_id',
            'sender_id' => 'sender_id',
            'body' => 'body',
            'type' => 'type',
            'metadata' => 'metadata',
            'created_at' => 'created_at'
        ]
    ];

    public const app_qy_v1_USER_PRESENCE = [
        'tablename' => 'user_presence',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'status' => 'status',
            'last_seen_at' => 'last_seen_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const app_qy_v1_NOTIFICATIONS = [
        'tablename' => 'notifications',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'type' => 'type',
            'payload' => 'payload',
            'read_at' => 'read_at',
            'created_at' => 'created_at'
        ]
    ];

    public const app_qy_v1_SOCIAL_EVENTS = [
        'tablename' => 'social_events',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'event' => 'event',
            'data' => 'data',
            'created_at' => 'created_at'
        ]
    ];

    // ---- Social Center expansion: posts / feed + live ----

    public const app_qy_v1_POSTS = [
        'tablename' => 'posts',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'content' => 'content',
            'post_type' => 'post_type',
            'video_url' => 'video_url',
            'external_url' => 'external_url',
            'cover_image_url' => 'cover_image_url',
            'visibility' => 'visibility',
            'like_count' => 'like_count',
            'comment_count' => 'comment_count',
            'metadata' => 'metadata',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_POST_IMAGES = [
        'tablename' => 'post_images',
        'fields' => [
            'id' => 'id',
            'post_id' => 'post_id',
            'image_url' => 'image_url',
            'sequence' => 'sequence',
            'caption' => 'caption',
            'created_at' => 'created_at'
        ]
    ];

    public const app_qy_v1_POST_LIKES = [
        'tablename' => 'post_likes',
        'fields' => [
            'id' => 'id',
            'post_id' => 'post_id',
            'user_id' => 'user_id',
            'created_at' => 'created_at'
        ]
    ];

    public const app_qy_v1_POST_COMMENTS = [
        'tablename' => 'post_comments',
        'fields' => [
            'id' => 'id',
            'post_id' => 'post_id',
            'user_id' => 'user_id',
            'parent_comment_id' => 'parent_comment_id',
            'body' => 'body',
            'created_at' => 'created_at',
            'deleted_at' => 'deleted_at'
        ]
    ];

    public const app_qy_v1_LIVE_SESSIONS = [
        'tablename' => 'live_sessions',
        'fields' => [
            'id' => 'id',
            'host_id' => 'host_id',
            'title' => 'title',
            'description' => 'description',
            'status' => 'status',
            'external_url' => 'external_url',
            'viewer_count' => 'viewer_count',
            'started_at' => 'started_at',
            'ended_at' => 'ended_at',
            'created_at' => 'created_at'
        ]
    ];

    public const app_qy_v1_LIVE_MESSAGES = [
        'tablename' => 'live_messages',
        'fields' => [
            'id' => 'id',
            'session_id' => 'session_id',
            'user_id' => 'user_id',
            'body' => 'body',
            'created_at' => 'created_at'
        ]
    ];

    public const app_qy_v1_LIVE_VIEWERS = [
        'tablename' => 'live_viewers',
        'fields' => [
            'id' => 'id',
            'session_id' => 'session_id',
            'user_id' => 'user_id',
            'last_seen_at' => 'last_seen_at'
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
     * Per-language authoritative sentence store (Books v3 unified model).
     *
     * Replaces the single shared {prefix}_sentences table. One table per
     * supported language code, exactly mirroring getDictionaryTableName():
     * {prefix}_sentences_{lang}. Created by the per-language sentence migration
     * which loops getSupportedLanguages().
     */
    public static function getSentenceTableName(string $langCode): string
    {
        $prefix = self::getTablePrefix();
        $langCode = strtolower($langCode);
        return "{$prefix}_sentences_{$langCode}";
    }

    /**
     * Per-language chapter store (Books v3.1 unified model — see
     * BOOKS_FEATURE_SPECIFICATION.md §3.2).
     *
     * Replaces the removed single shared {prefix}_chapters table. One table per
     * supported language code, mirroring getSentenceTableName():
     * {prefix}_chapters_{lang}. Created by the per-language chapter migration
     * which loops getSupportedLanguages().
     */
    public static function getChapterTableName(string $langCode): string
    {
        $prefix = self::getTablePrefix();
        $langCode = strtolower($langCode);
        return "{$prefix}_chapters_{$langCode}";
    }

    /**
     * Normalize any language name or code to the canonical 2/3-letter CODE used
     * by every per-language table (Books v3.1 §2 — codes only, no name/code dual
     * lookup). Blank input returns ''.
     */
    public static function normalizeLangCode(string $language): string
    {
        $lang = strtolower(trim($language));
        if ($lang === '') {
            return '';
        }
        $nameToCode = [
            'english' => 'en',
            'chinese' => 'zh',
            'japanese' => 'ja',
            'korean' => 'ko',
            'vietnamese' => 'vi',
            'lao' => 'lo',
            'russian' => 'ru',
            'greek' => 'el',
            'arabic' => 'ar',
            'hebrew' => 'he',
            'thai' => 'th',
            'french' => 'fr',
            'german' => 'de',
            'spanish' => 'es',
            'italian' => 'it',
            'portuguese' => 'pt',
        ];
        if (isset($nameToCode[$lang])) {
            return $nameToCode[$lang];
        }
        return $lang;
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
            "{$prefix}_PERSONAL_DICTIONARIES",
            "{$prefix}_PERSONAL_DICTIONARY_ENTRIES",
            "{$prefix}_WORD_GROUPS",
            "{$prefix}_GROUP_WORD_PROGRESS",
            "{$prefix}_USER_BOOK_READING_PROGRESS",
            "{$prefix}_USER_LEARNING_PROGRESS",
            "{$prefix}_USER_FOLLOWS",
            "{$prefix}_DAILY_RECITATION_LOGS",
            "{$prefix}_USER_SELECTED_LIBRARIES",
            // Social subsystem
            "{$prefix}_FRIEND_REQUESTS",
            "{$prefix}_CONVERSATIONS",
            "{$prefix}_CONVERSATION_PARTICIPANTS",
            "{$prefix}_MESSAGES",
            "{$prefix}_USER_PRESENCE",
            "{$prefix}_NOTIFICATIONS",
            "{$prefix}_SOCIAL_EVENTS",
            // Social Center expansion
            "{$prefix}_POSTS",
            "{$prefix}_POST_IMAGES",
            "{$prefix}_POST_LIKES",
            "{$prefix}_POST_COMMENTS",
            "{$prefix}_LIVE_SESSIONS",
            "{$prefix}_LIVE_MESSAGES",
            "{$prefix}_LIVE_VIEWERS"
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

