<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    private $languages = [
        'af', 'am', 'ar', 'as', 'az', 'bg', 'bn', 'bs', 'ca', 'cs',
        'cy', 'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi',
        'fil', 'fr', 'ga', 'gl', 'gu', 'he', 'hi', 'hr', 'hu', 'hy',
        'id', 'is', 'it', 'ja', 'jv', 'ka', 'kk', 'km', 'kn', 'ko',
        'lo', 'lt', 'lv', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
        'nb', 'ne', 'nl', 'or', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru',
        'si', 'sk', 'sl', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'ta',
        'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'wuu', 'yue', 'zh', 'zu'
    ];

    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        foreach ($this->languages as $langCode) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, "{$langCode}_dictionaries");
            
            $tableStructure = [
                'columns' => [
                    'id' => [
                        'type' => 'bigIncrements',
                    ],
                    'content' => [
                        'type' => 'text',
                        'nullable' => false,
                    ],
                    'md5' => [
                        'type' => 'string',
                        'length' => 32,
                        'nullable' => false,
                        'index' => true,
                    ],
                    'translations' => [
                        'type' => 'json',
                        'nullable' => true,
                        'comment' => 'Multi-language translations JSON array',
                    ],
                    'has_translation' => [
                        'type' => 'boolean',
                        'nullable' => true,
                        'default' => false,
                    ],
                    'translation_provider' => [
                        'type' => 'string',
                        'length' => 100,
                        'nullable' => true,
                        'comment' => 'AI model identifier',
                    ],
                    'phonetic' => [
                        'type' => 'text',
                        'nullable' => true,
                        'comment' => 'IPA phonetic or language-specific phonetic',
                    ],
                    'us_phonetic' => [
                        'type' => 'text',
                        'nullable' => true,
                        'comment' => 'US English phonetic',
                    ],
                    'uk_phonetic' => [
                        'type' => 'text',
                        'nullable' => true,
                        'comment' => 'UK English phonetic',
                    ],
                    'tts_files' => [
                        'type' => 'json',
                        'nullable' => true,
                        'comment' => 'TTS audio files paths and metadata',
                    ],
                    'tts_provider' => [
                        'type' => 'string',
                        'length' => 100,
                        'nullable' => true,
                        'comment' => 'TTS service provider',
                    ],
                    'image_files' => [
                        'type' => 'json',
                        'nullable' => true,
                        'comment' => 'Associated image files',
                    ],
                    'image_provider' => [
                        'type' => 'string',
                        'length' => 100,
                        'nullable' => true,
                    ],
                    'word_details' => [
                        'type' => 'json',
                        'nullable' => true,
                        'comment' => 'Additional word metadata: part of speech, examples, etc',
                    ],
                    'is_exist_local' => [
                        'type' => 'boolean',
                        'nullable' => true,
                        'default' => false,
                    ],
                    'has_operations' => [
                        'type' => 'boolean',
                        'nullable' => true,
                        'default' => true,
                    ],
                    'query_count' => [
                        'type' => 'integer',
                        'nullable' => true,
                        'default' => 0,
                        'unsigned' => true,
                    ],
                    'last_modified' => [
                        'type' => 'dateTime',
                        'nullable' => true,
                    ],
                    'last_query_time' => [
                        'type' => 'dateTime',
                        'nullable' => true,
                    ],
                    'created_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                    'updated_at' => [
                        'type' => 'timestamp',
                        'nullable' => true,
                    ],
                ],
                'indexes' => [
                    [
                        'columns' => ['content', 'md5'],
                        'name' => "unique_{$langCode}_content_md5",
                        'unique' => true,
                    ],
                    [
                        'columns' => ['content'],
                        'name' => "idx_{$langCode}_content",
                    ],
                    [
                        'columns' => ['query_count'],
                        'name' => "idx_{$langCode}_query_count",
                    ],
                    [
                        'columns' => ['has_translation'],
                        'name' => "idx_{$langCode}_has_translation",
                    ],
                    [
                        'columns' => ['last_query_time'],
                        'name' => "idx_{$langCode}_last_query_time",
                    ],
                ],
            ];
            
            SafeMigrationHelper::alignTableStructureFromArray(
                $this->connection,
                $tableName,
                $tableStructure,
                [
                    'shrink_columns' => false,
                    'modify_columns' => true,
                    'add_indexes' => true,
                ]
            );
        }
    }

    public function down(): void
    {
        foreach ($this->languages as $langCode) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, "{$langCode}_dictionaries");
            \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($tableName);
        }
    }
};
