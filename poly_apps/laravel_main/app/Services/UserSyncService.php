<?php

namespace App\Services;

use App\Models\User;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

class UserSyncService
{
    /**
     * Get all sub-app keys from AppKeys constants
     * 
     * @return array
     */
    public static function getSubAppKeys(): array
    {
        return AppKeys::all();
    }
    
    public static function syncUserToAllApps(array $userData): array
    {
        $results = [
            'main' => false,
            'sub_apps' => [],
            'errors' => [],
        ];
        
        DB::beginTransaction();
        
        try {
            $mainUser = User::create($userData);
            $results['main'] = true;
            $results['main_user_id'] = $mainUser->id;
            
            foreach (self::getSubAppKeys() as $appKey) {
                try {
                    $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
                    
                    if (!config("database.connections.{$connectionName}")) {
                        $results['sub_apps'][$appKey] = 'skipped_no_connection';
                        continue;
                    }
                    
                    if (!self::tableExists($connectionName, 'users')) {
                        $results['sub_apps'][$appKey] = 'skipped_no_table';
                        continue;
                    }
                    
                    $subAppData = array_merge($userData, [
                        'main_user_id' => $mainUser->id,
                    ]);
                    
                    // Use model connection instead of DB::connection()
                    $userModel = new User();
                    $userModel->setConnection($connectionName);
                    $userModel->getConnection()->table('users')->insert($subAppData);
                    
                    $results['sub_apps'][$appKey] = 'success';
                    
                } catch (\Exception $e) {
                    Log::error("[UserSync] Failed to sync user to {$appKey}: " . $e->getMessage());
                    $results['sub_apps'][$appKey] = 'error';
                    $results['errors'][$appKey] = $e->getMessage();
                }
            }
            
            DB::commit();
            
            return [
                'success' => true,
                'user' => $mainUser,
                'sync_results' => $results,
            ];
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('[UserSync] Failed to create main user: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'sync_results' => $results,
            ];
        }
    }
    
    private static function tableExists(string $connection, string $table): bool
    {
        try {
            return Schema::connection($connection)->hasTable($table);
        } catch (\Exception $e) {
            return false;
        }
    }
    
    public static function getTableStructure(string $connection, string $tableName): array
    {
        try {
            $schema = Schema::connection($connection);
            
            if (!$schema->hasTable($tableName)) {
                return [];
            }
            
            $config = config("database.connections.{$connection}");
            $driver = $config['driver'] ?? 'sqlite';
            
            // For SQLite, use PRAGMA for detailed structure info
            if ($driver === 'sqlite') {
                // Use model connection for query builder, DB::connection() for raw SQL
                $dbConnection = DB::connection($connection);
                $columns = $dbConnection->select("PRAGMA table_info({$tableName})");
                $structure = [];
                
                foreach ($columns as $column) {
                    $structure[] = [
                        'name' => $column->name,
                        'type' => $column->type,
                        'notnull' => $column->notnull ? 'NOT NULL' : 'NULL',
                        'default' => $column->dflt_value,
                        'pk' => $column->pk ? 'PK' : '',
                    ];
                }
                
                return $structure;
            }
            
            // For other databases, use Schema Builder
            $columns = $schema->getColumnListing($tableName);
            $structure = [];
            
            foreach ($columns as $columnName) {
                $columnType = $schema->getColumnType($tableName, $columnName);
                $structure[] = [
                    'name' => $columnName,
                    'type' => $columnType,
                    'notnull' => '',
                    'default' => null,
                    'pk' => '',
                ];
            }
            
            return $structure;
        } catch (\Exception $e) {
            Log::error("[TableStructure] Failed to get structure for {$tableName}: " . $e->getMessage());
            return [];
        }
    }
    
    public static function getTableIndexes(string $connection, string $tableName): array
    {
        try {
            $schema = Schema::connection($connection);
            
            if (!$schema->hasTable($tableName)) {
                return [];
            }
            
            $config = config("database.connections.{$connection}");
            $driver = $config['driver'] ?? 'sqlite';
            
            // For SQLite, use PRAGMA for detailed index info
            if ($driver === 'sqlite') {
                // Use DB::connection() for raw SQL queries (PRAGMA)
                $dbConnection = DB::connection($connection);
                $indexes = $dbConnection->select("PRAGMA index_list({$tableName})");
                $indexDetails = [];
                
                foreach ($indexes as $index) {
                    $indexInfo = $dbConnection->select("PRAGMA index_info({$index->name})");
                    $columns = array_map(fn($col) => $col->name, $indexInfo);
                    
                    $indexDetails[] = [
                        'name' => $index->name,
                        'unique' => $index->unique ? 'UNIQUE' : '',
                        'columns' => implode(', ', $columns),
                    ];
                }
                
                return $indexDetails;
            }
            
            // For other databases, try to get indexes from information_schema
            // Note: This is a simplified approach, full implementation would require
            // database-specific queries
            $indexDetails = [];
            try {
                // Use DB::connection() for raw SQL queries (SHOW INDEXES)
                $dbConnection = DB::connection($connection);
                $indexes = $dbConnection->select("SHOW INDEXES FROM {$tableName}");
                
                foreach ($indexes as $index) {
                    $indexDetails[] = [
                        'name' => $index->Key_name ?? $index->key_name ?? '',
                        'unique' => ($index->Non_unique ?? $index->non_unique ?? 1) == 0 ? 'UNIQUE' : '',
                        'columns' => $index->Column_name ?? $index->column_name ?? '',
                    ];
                }
            } catch (\Exception $e) {
                // Fallback: return empty array if SHOW INDEXES is not supported
                Log::debug("[TableIndexes] Could not get indexes for {$tableName}: " . $e->getMessage());
            }
            
            return $indexDetails;
        } catch (\Exception $e) {
            Log::error("[TableIndexes] Failed to get indexes for {$tableName}: " . $e->getMessage());
            return [];
        }
    }
    
    public static function ensureUserTablesExist(): array
    {
        $results = [];

        if (self::tableExists('sqlite', 'users')) {
            $results['Main'] = 'exists';
        } else {
            $results['Main'] = 'skipped - will be created by migrations';
        }

        if (self::tableExists('sqlite', 'personal_access_tokens')) {
            $results['Main (personal_access_tokens)'] = 'exists';
        } else {
            $results['Main (personal_access_tokens)'] = 'skipped - will be created by migrations';
        }

        foreach (self::getSubAppKeys() as $appKey) {
            $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);

            if (!config("database.connections.{$connectionName}")) {
                $results[$appKey] = 'no_connection';
                continue;
            }

            if (!self::tableExists($connectionName, 'users')) {
                self::createUserTable($connectionName);
                $results[$appKey] = 'created';
            } else {
                $results[$appKey] = 'exists';
            }
        }

        return $results;
    }
    
    private static function createUserTable(string $connection): void
    {
        $config = config("database.connections.{$connection}");
        if ($config && $config['driver'] === 'sqlite') {
            $dbPath = $config['database'];
            if (!file_exists($dbPath)) {
                $dir = dirname($dbPath);
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                touch($dbPath);
                chmod($dbPath, 0664);
            }
        }
        
        if (Schema::connection($connection)->hasTable('users')) {
            return;
        }
        
        Schema::connection($connection)->create('users', function (Blueprint $table) use ($connection) {
            $table->id();
            
            if ($connection !== 'sqlite') {
                $table->unsignedBigInteger('main_user_id');
            }
            
            $table->string('username')->nullable();
            $table->string('name')->nullable();
            $table->string('nickname')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('remember_token', 100)->nullable();
            $table->text('avatar')->nullable();
            
            if ($connection !== 'sqlite') {
                $table->integer('credit')->default(0);
            }
            
            $table->timestamps();
            
            if ($connection === 'sqlite') {
                $table->unique('email');
            }
            
            if ($connection !== 'sqlite') {
                $table->foreign('main_user_id')->references('id')->on('users')->onDelete('cascade');
            }
            
            $table->index('main_user_id');
            $table->index('username');
            $table->index('email');
            $table->index('nickname');
        });
    }

    private static function createPersonalAccessTokensTable(string $connection): void
    {
        $config = config("database.connections.{$connection}");
        if ($config && $config['driver'] === 'sqlite') {
            $dbPath = $config['database'];
            if (!file_exists($dbPath)) {
                $dir = dirname($dbPath);
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                touch($dbPath);
                chmod($dbPath, 0664);
            }
        }

        if (Schema::connection($connection)->hasTable('personal_access_tokens')) {
            return;
        }

        Schema::connection($connection)->create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('tokenable_type');
            $table->unsignedBigInteger('tokenable_id');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            
            $table->index(['tokenable_type', 'tokenable_id']);
            $table->index('token');
        });
    }

    public static function ensureTTSCacheTablesExist(): array
    {
        $results = [];
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_cache');

        if (Schema::connection($connection)->hasTable($tableName)) {
            $results[$tableName] = 'exists';
            return $results;
        }

        Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();
            $table->string('text_hash', 32)->unique();
            $table->text('text');
            $table->string('language', 10);
            $table->string('type', 50);
            $table->string('voice', 100)->nullable();
            $table->text('audio_path');
            $table->integer('audio_size')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('last_accessed')->useCurrent();
            $table->integer('access_count')->default(1);
            
            $table->index('text_hash');
            $table->index('language');
            $table->index('type');
            $table->index('last_accessed');
        });

        $results[$tableName] = 'created';

        return $results;
    }

    public static function ensureMultiLangDictionaryTablesExist($progressCallback = null): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $schema = Schema::connection($connection);

        $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();
        $total = count($supportedLanguages);
        $current = 0;

        foreach ($supportedLanguages as $langCode) {
            $current++;
            $tableName = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName($langCode);

            if (!$schema->hasTable($tableName)) {
                $schema->create($tableName, function ($table) {
                    $table->increments('id');
                    $table->text('content');
                    $table->string('md5', 32)->unique();
                    $table->text('translations')->nullable();
                    $table->boolean('has_translation')->default(false);
                    $table->string('translation_provider', 50)->nullable();
                    $table->text('phonetic')->nullable();
                    $table->text('us_phonetic')->nullable();
                    $table->text('uk_phonetic')->nullable();
                    $table->text('tts_files')->nullable();
                    $table->string('tts_provider', 50)->nullable();
                    $table->boolean('has_audio')->default(false);
                    $table->text('image_files')->nullable();
                    $table->string('image_provider', 50)->nullable();
                    $table->text('word_details')->nullable();
                    $table->boolean('is_exist_local')->default(false);
                    $table->boolean('has_operations')->default(false);
                    $table->integer('query_count')->default(0);
                    $table->timestamp('last_modified')->nullable();
                    $table->timestamp('last_query_time')->nullable();
                    $table->timestamps();

                    $table->index('md5');
                    $table->index('content');
                    $table->index(['query_count'], null, 'desc');
                    $table->index('has_translation');
                    $table->index('has_audio');
                });

                $results[$tableName] = 'created';
            } else {
                if (!$schema->hasColumn($tableName, 'has_audio')) {
                    $schema->table($tableName, function ($table) {
                        $table->boolean('has_audio')->default(false)->after('tts_provider');
                        $table->index('has_audio');
                    });
                    $results[$tableName] = 'migrated';
                } else {
                    $results[$tableName] = 'exists';
                }
            }

            if ($progressCallback && $current % 10 === 0) {
                $progressCallback($current, $total);
            }
        }

        if ($progressCallback) {
            $progressCallback($total, $total);
        }

        return $results;
    }

    public static function ensureMultilingualWordTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();

        $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $pattern = $prefix . '_%_dictionaries';
        $allDictTables = $dbConnection
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name", [$pattern]);

        foreach ($allDictTables as $tableObj) {
            $tableName = $tableObj->name;
            $results[$tableName] = 'exists';
        }

        $languages = [
            'lao' => ['lo', 'Lao'],
            'japanese' => ['ja', 'Japanese'],
            'vietnamese' => ['vi', 'Vietnamese'],
            'english' => ['en', 'English'],
        ];

        foreach ($languages as $langKey => $langInfo) {
            list($langCode, $langName) = $langInfo;
            $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, "{$langCode}_dictionaries");

            if (isset($results[$tableName])) {
                continue;
            }

            if (Schema::connection($connection)->hasTable($tableName)) {
                $results[$tableName] = 'exists';
                continue;
            }

            // Create dictionary table with standardized structure
            if ($langKey === 'english') {
                Schema::connection($connection)->create($tableName, function (Blueprint $table) use ($langCode) {
                    $table->id();
                    $table->text('content');
                    $table->string('md5');
                    $table->text('translations')->nullable();
                    $table->boolean('has_translation')->default(false);
                    $table->string('translation_provider')->nullable();
                    $table->text('phonetic')->nullable();
                    $table->text('us_phonetic')->nullable();
                    $table->text('uk_phonetic')->nullable();
                    $table->text('tts_files')->nullable();
                    $table->string('tts_provider')->nullable();
                    $table->text('image_files')->nullable();
                    $table->string('image_provider')->nullable();
                    $table->text('word_details')->nullable();
                    $table->boolean('is_exist_local')->default(false);
                    $table->boolean('has_operations')->default(true);
                    $table->integer('query_count')->default(0);
                    $table->dateTime('last_modified')->nullable();
                    $table->dateTime('last_query_time')->nullable();
                    $table->timestamps();
                    
                    $table->unique(['content', 'md5'], "unique_{$langCode}_content_md5");
                    $table->index('content', "idx_{$langCode}_content");
                    $table->index('query_count', "idx_{$langCode}_query_count");
                    $table->index('has_translation', "idx_{$langCode}_has_translation");
                    $table->index('last_query_time', "idx_{$langCode}_last_query_time");
                });
            } else {
                // For other languages, use similar structure
                Schema::connection($connection)->create($tableName, function (Blueprint $table) use ($langCode) {
                    $table->id();
                    $table->text('content');
                    $table->string('md5');
                    $table->text('pronunciation')->nullable();
                    $table->text('meaning_en')->nullable();
                    $table->text('meaning_zh')->nullable();
                    $table->text('translations')->nullable();
                    $table->boolean('has_translation')->default(false);
                    $table->text('phonetic')->nullable();
                    $table->text('tts_files')->nullable();
                    $table->text('image_files')->nullable();
                    $table->text('word_details')->nullable();
                    $table->integer('query_count')->default(0);
                    $table->dateTime('last_query_time')->nullable();
                    $table->timestamps();
                    
                    $table->unique(['content', 'md5'], "unique_{$langCode}_content_md5");
                    $table->index('content', "idx_{$langCode}_content");
                    $table->index('has_translation', "idx_{$langCode}_has_translation");
                });
            }

            $results[$tableName] = 'created';
        }

        return $results;
    }

    public static function importMultilingualWordsFromMd(): array
    {
        $results = [
            'total_files' => 0,
            'total_words' => 0,
            'imported' => 0,
            'errors' => [],
        ];
        
        $appKey = AppKeys::APPQYV1;
        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();
        $dataDir = base_path('init_data/AppQyV1/Multilingual_basic_data/Inspection_table');
        
        if (!is_dir($dataDir)) {
            $results['errors'][] = "Directory not found: {$dataDir}";
            return $results;
        }
        
        $mdFiles = glob("{$dataDir}/*.md");
        $results['total_files'] = count($mdFiles);
        
        $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('en');
        $existingCount = $dbConnection->table($enDictTable)->count();
        if ($existingCount > 0) {
            $results['skipped'] = true;
            $results['message'] = "Tables already have {$existingCount} records, skipping import";
            return $results;
        }
        
        $laoData = [];
        $japaneseData = [];
        $vietnameseData = [];
        
        foreach ($mdFiles as $file) {
            $content = file_get_contents($file);
            $lines = explode("\n", $content);
            
            foreach ($lines as $line) {
                $line = trim($line);
                
                if (empty($line) || strpos($line, '| #') === 0 || strpos($line, '|---') === 0 || strpos($line, '# ') === 0) {
                    continue;
                }
                
                if (strpos($line, '|') !== 0) {
                    continue;
                }
                
                $parts = array_map('trim', explode('|', $line));
                array_shift($parts);
                array_pop($parts);
                
                if (count($parts) < 10) {
                    continue;
                }
                
                $wordId = intval($parts[0]);
                if ($wordId <= 0) {
                    continue;
                }
                
                $english = $parts[1];
                $lao = $parts[2];
                $laoPronunciation = $parts[3];
                $japanese = $parts[4];
                $japanesePronunciation = $parts[5];
                $vietnamese = $parts[6];
                $vietnamesePronunciation = $parts[7];
                $meaningEn = $parts[8];
                $meaningZh = $parts[9];
                
                $now = now();
                
                
                $laoData[] = [
                    'content' => $lao,
                    'md5' => md5($lao),
                    'pronunciation' => $laoPronunciation,
                    'meaning_en' => $meaningEn,
                    'meaning_zh' => $meaningZh,
                    'has_translation' => !empty($meaningZh) ? 1 : 0,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $japaneseData[] = [
                    'content' => $japanese,
                    'md5' => md5($japanese),
                    'pronunciation' => $japanesePronunciation,
                    'meaning_en' => $meaningEn,
                    'meaning_zh' => $meaningZh,
                    'has_translation' => !empty($meaningZh) ? 1 : 0,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $vietnameseData[] = [
                    'content' => $vietnamese,
                    'md5' => md5($vietnamese),
                    'pronunciation' => $vietnamesePronunciation,
                    'meaning_en' => $meaningEn,
                    'meaning_zh' => $meaningZh,
                    'has_translation' => !empty($meaningZh) ? 1 : 0,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                
                $results['total_words']++;
            }
        }
        
        try {
            $chunkSize = 500;

            foreach (array_chunk($laoData, $chunkSize) as $chunk) {
                $loDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('lo');
                $dbConnection->table($loDictTable)->insert($chunk);
            }

            foreach (array_chunk($japaneseData, $chunkSize) as $chunk) {
                $jaDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('ja');
                $dbConnection->table($jaDictTable)->insert($chunk);
            }

            foreach (array_chunk($vietnameseData, $chunkSize) as $chunk) {
                $viDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('vi');
                $dbConnection->table($viDictTable)->insert($chunk);
            }

            $results['imported'] = $results['total_words'];

        } catch (\Exception $e) {
            Log::error("[UserSync] Failed to import multilingual words: " . $e->getMessage());
            $results['errors'][] = $e->getMessage();
        }
        
        return $results;
    }

    public static function initializeDictionaryStep2(): array
    {
        $results = [
            'step1_rename_7z' => [],
            'step2_extract_json' => [],
            'step3_import_words' => [],
            'step4_update_translations' => [],
        ];
        
        try {
            $results['step1_rename_7z'] = self::process7zFiles();
            $results['step3_import_words'] = self::importDictionaryWords();
            $results['step4_update_translations'] = self::importTranslationsFromJson();
            
        } catch (\Exception $e) {
            Log::error("[DictionaryInit] Failed: " . $e->getMessage());
            $results['error'] = $e->getMessage();
        }
        
        return $results;
    }

    private static function importTranslationsFromJson(): array
    {
        $jsonFile = \App\Providers\PathMapper::getLaravelTmpDir() . '/dictionary_import/extracted/olddb.txt';
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $delimiter = '------------------------------TokenLine-----------------------------';
        
        if (!file_exists($jsonFile)) {
            return ['error' => 'JSON file not found: ' . $jsonFile];
        }
        
        $handle = fopen($jsonFile, 'r');
        if (!$handle) {
            return ['error' => 'Failed to open JSON file'];
        }
        
        $buffer = '';
        $processed = 0;
        $updated = 0;
        $inserted = 0;
        $errors = 0;
        $batch = [];
        $batchSize = 100;
        
        while (!feof($handle)) {
            $chunk = fread($handle, 65536);
            $buffer .= $chunk;
            
            while (($pos = strpos($buffer, $delimiter)) !== false) {
                $item = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + strlen($delimiter));
                
                if (empty($item)) continue;
                
                $data = json_decode($item, true);
                if (!$data || !isset($data['content'])) {
                    $errors++;
                    continue;
                }
                
                $word = $data['content'];
                $usPhonetic = $data['us_phonetic'] ?? null;
                $ukPhonetic = $data['uk_phonetic'] ?? null;
                
                $translation = $data['translation'] ?? [];
                
                if (isset($translation['synonyms_type'])) {
                    $translation['synonyms_type'] = array_map(function($v) {
                        return strip_tags(html_entity_decode($v));
                    }, $translation['synonyms_type']);
                }
                
                if (isset($translation['advanced_translate_type'])) {
                    $translation['advanced_translate_type'] = array_map(function($v) {
                        return strip_tags(html_entity_decode($v));
                    }, $translation['advanced_translate_type']);
                }
                
                unset($translation['voice_files']);
                unset($translation['phonetic_symbol']);
                
                $sampleImages = [];
                if (isset($data['sample_images'])) {
                    foreach ($data['sample_images'] as $img) {
                        if (isset($img['save_filename'])) {
                            $sampleImages[] = $img['save_filename'];
                        }
                    }
                }
                
                $batch[] = [
                    'content' => $word,
                    'md5' => md5($word),
                    'us_phonetic' => $usPhonetic,
                    'uk_phonetic' => $ukPhonetic,
                    'translations' => json_encode($translation, JSON_UNESCAPED_UNICODE),
                    'image_files' => json_encode($sampleImages, JSON_UNESCAPED_UNICODE),
                    'has_translation' => !empty($translation) ? 1 : 0,
                ];
                
                $processed++;
                
                if (count($batch) >= $batchSize) {
                    $result = self::upsertTranslationBatch($connection, $batch);
                    $updated += $result['updated'];
                    $inserted += $result['inserted'];
                    $batch = [];
                }
            }
        }
        
        if (!empty($batch)) {
            $result = self::upsertTranslationBatch($connection, $batch);
            $updated += $result['updated'];
            $inserted += $result['inserted'];
        }
        
        fclose($handle);
        
        return [
            'processed' => $processed,
            'updated' => $updated,
            'inserted' => $inserted,
            'errors' => $errors,
        ];
    }

    private static function upsertTranslationBatch(string $connection, array $batch): array
    {
        $updated = 0;
        $inserted = 0;
        $now = now();
        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();

        foreach ($batch as $item) {
            $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('en');
            $existing = $dbConnection
                ->table($enDictTable)
                ->where('content', $item['content'])
                ->where('md5', $item['md5'])
                ->first();

            if ($existing) {
                $dbConnection
                    ->table($enDictTable)
                    ->where('id', $existing->id)
                    ->update([
                        'us_phonetic' => $item['us_phonetic'],
                        'uk_phonetic' => $item['uk_phonetic'],
                        'translations' => $item['translations'],
                        'image_files' => $item['image_files'],
                        'has_translation' => $item['has_translation'],
                        'updated_at' => $now,
                    ]);
                $updated++;
            } else {
                $dbConnection
                    ->table($enDictTable)
                    ->insert([
                        'content' => $item['content'],
                        'md5' => $item['md5'],
                        'us_phonetic' => $item['us_phonetic'],
                        'uk_phonetic' => $item['uk_phonetic'],
                        'translations' => $item['translations'],
                        'image_files' => $item['image_files'],
                        'has_translation' => $item['has_translation'],
                        'query_count' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                $inserted++;
            }
        }

        return ['updated' => $updated, 'inserted' => $inserted];
    }

    private static function process7zFiles(): array
    {
        $translateDir = base_path('init_data/AppQyV1/VoiceStaticServer/translate');
        $tmpDir = \App\Providers\PathMapper::getLaravelTmpDir() . '/dictionary_import';
        $extractDir = "{$tmpDir}/extracted";
        $jsonFile = "{$extractDir}/olddb.txt";
        
        if (file_exists($jsonFile)) {
            return [
                'skipped' => true,
                'message' => 'JSON already extracted',
                'json_file' => $jsonFile,
                'json_size' => filesize($jsonFile),
            ];
        }
        
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0755, true);
        }
        
        $jsFiles = glob("{$translateDir}/*.js");
        $results = [
            'total_files' => count($jsFiles),
            'renamed' => 0,
            'extracted' => 0,
            'errors' => [],
        ];
        
        foreach ($jsFiles as $jsFile) {
            $basename = basename($jsFile);
            
            preg_match('/olddb\.7z\.(\d+)\.expected_ext_marker\.j7son\.js/', $basename, $matches);
            if (!$matches) {
                $results['errors'][] = "Skipped: {$basename} (invalid format)";
                continue;
            }
            
            $partNumber = $matches[1];
            $newFilename = "olddb.7z.{$partNumber}";
            $newPath = "{$tmpDir}/{$newFilename}";
            
            if (copy($jsFile, $newPath)) {
                $results['renamed']++;
            } else {
                $results['errors'][] = "Failed to copy: {$basename}";
            }
        }
        
        if ($results['renamed'] > 0) {
            $combinedFile = "{$tmpDir}/olddb.7z";
            
            exec("cd {$tmpDir} && cat olddb.7z.* > olddb.7z 2>&1", $output, $returnCode);
            
            if ($returnCode === 0 && file_exists($combinedFile)) {
                if (!is_dir($extractDir)) {
                    mkdir($extractDir, 0755, true);
                }
                
                exec("7z x \"{$combinedFile}\" -o\"{$extractDir}\" -y 2>&1", $extractOutput, $extractCode);
                
                if ($extractCode === 0) {
                    $results['extracted'] = 1;
                    $results['extract_dir'] = $extractDir;
                    
                    if (file_exists($jsonFile)) {
                        $results['json_file'] = $jsonFile;
                        $results['json_size'] = filesize($jsonFile);
                    }
                } else {
                    $results['errors'][] = "Failed to extract: " . implode("\n", $extractOutput);
                }
            } else {
                $results['errors'][] = "Failed to combine parts: " . implode("\n", $output);
            }
        }
        
        return $results;
    }

    private static function importDictionaryWords(): array
    {
        $outputFile = base_path('init_data/AppQyV1/VoiceStaticServer/dictionary/output.txt');
        $appKey = AppKeys::APPQYV1;
        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();
        
        if (!file_exists($outputFile)) {
            return ['error' => 'output.txt not found'];
        }
        
        $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('en');
        $existingCount = $dbConnection->table($enDictTable)->count();
        if ($existingCount > 50000) {
            return [
                'skipped' => true,
                'message' => "Already imported {$existingCount} words, skipping",
            ];
        }

        $handle = fopen($outputFile, 'r');
        if (!$handle) {
            return ['error' => 'Failed to open output.txt'];
        }

        $batch = [];
        $imported = 0;
        $now = now();

        while (($line = fgets($handle)) !== false) {
            $word = trim($line);
            if (empty($word)) {
                continue;
            }

            $batch[] = [
                'content' => $word,
                'md5' => md5($word),
                'us_phonetic' => null,
                'uk_phonetic' => null,
                'translations' => null,
                'image_files' => null,
                'has_translation' => 0,
                'query_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($batch) >= 1000) {
                $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('en');
                // Use model connection for query builder
                $dbConnection->table($enDictTable)->insert($batch);
                $imported += count($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName('en');
            // Use model connection for query builder
            $dbConnection->table($enDictTable)->insert($batch);
            $imported += count($batch);
        }
        
        fclose($handle);

        return [
            'imported' => $imported,
            'total_words' => $imported,
        ];
    }

    public static function getVoiceFilePath($wordId, $word, $language = 'en'): ?string
    {
        $baseDir = \App\Providers\PathMapper::getLaravelStaticDir() . '/voice';
        
        $namespace = str_pad(floor(($wordId - 1) / 1000) * 1000 + 1, 4, '0', STR_PAD_LEFT);
        $path = "{$baseDir}/{$language}/{$namespace}/{$word}.mp3";
        
        if (file_exists($path)) {
            return $path;
        }
        
        $firstLetter = strtolower(substr($word, 0, 1));
        $path = "{$baseDir}/{$language}/{$firstLetter}/{$word}.mp3";
        
        if (file_exists($path)) {
            return $path;
        }
        
        $path = "{$baseDir}/{$language}/{$word}.mp3";
        
        if (file_exists($path)) {
            return $path;
        }
        
        return null;
    }

    public static function ensureVoiceSubtitleTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::MCPV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'user_settings');

        if (Schema::connection($connection)->hasTable($tableName)) {
            $results[$tableName] = 'exists';
            return $results;
        }

        Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();
            $table->string('user_identifier', 100)->unique();
            $table->text('target_language')->default('["en"]');
            $table->string('default_voice', 100)->default('en-US-AriaNeural');
            $table->decimal('playback_rate', 3, 2)->default(1.0);
            $table->boolean('auto_play')->default(false);
            $table->string('play_mode', 50)->default('all');
            $table->integer('play_limit')->default(300);
            $table->string('play_group', 100)->nullable();
            $table->string('play_language', 50)->nullable();
            $table->timestamps();
            
            $table->index('user_identifier');
        });

        $results[$tableName] = 'created';

        return $results;
    }
}
