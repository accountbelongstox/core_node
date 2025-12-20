<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UserSyncService
{
    const SUB_APPS = [
        'AppQyV1',
        'AwyV0',
        'VipClubV1',
        'ServerManagerV1',
        'AChatV1',
        'CodeMartV1',
        'McpV1',
        'ItToolsV1',
        'BankV1',
    ];
    
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
            
            foreach (self::SUB_APPS as $appName) {
                try {
                    $connectionName = strtolower($appName);
                    
                    if (!config("database.connections.{$connectionName}")) {
                        $results['sub_apps'][$appName] = 'skipped_no_connection';
                        continue;
                    }
                    
                    if (!self::tableExists($connectionName, 'users')) {
                        $results['sub_apps'][$appName] = 'skipped_no_table';
                        continue;
                    }
                    
                    $subAppData = array_merge($userData, [
                        'main_user_id' => $mainUser->id,
                    ]);
                    
                    DB::connection($connectionName)->table('users')->insert($subAppData);
                    
                    $results['sub_apps'][$appName] = 'success';
                    
                } catch (\Exception $e) {
                    Log::error("[UserSync] Failed to sync user to {$appName}: " . $e->getMessage());
                    $results['sub_apps'][$appName] = 'error';
                    $results['errors'][$appName] = $e->getMessage();
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
            return DB::connection($connection)
                ->getSchemaBuilder()
                ->hasTable($table);
        } catch (\Exception $e) {
            return false;
        }
    }
    
    public static function getTableStructure(string $connection, string $tableName): array
    {
        try {
            $columns = DB::connection($connection)->select("PRAGMA table_info({$tableName})");
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
        } catch (\Exception $e) {
            Log::error("[TableStructure] Failed to get structure for {$tableName}: " . $e->getMessage());
            return [];
        }
    }
    
    public static function getTableIndexes(string $connection, string $tableName): array
    {
        try {
            $indexes = DB::connection($connection)->select("PRAGMA index_list({$tableName})");
            $indexDetails = [];
            
            foreach ($indexes as $index) {
                $indexInfo = DB::connection($connection)->select("PRAGMA index_info({$index->name})");
                $columns = array_map(fn($col) => $col->name, $indexInfo);
                
                $indexDetails[] = [
                    'name' => $index->name,
                    'unique' => $index->unique ? 'UNIQUE' : '',
                    'columns' => implode(', ', $columns),
                ];
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

        foreach (self::SUB_APPS as $appName) {
            $connectionName = strtolower($appName);

            if (!config("database.connections.{$connectionName}")) {
                $results[$appName] = 'no_connection';
                continue;
            }

            if (!self::tableExists($connectionName, 'users')) {
                self::createUserTable($connectionName);
                $results[$appName] = 'created';
            } else {
                $results[$appName] = 'exists';
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
        
        if ($connection === 'sqlite') {
            DB::connection($connection)->statement('
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(255),
                    name VARCHAR(255),
                    nickname VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    phone VARCHAR(20),
                    email_verified_at TIMESTAMP NULL,
                    password VARCHAR(255),
                    remember_token VARCHAR(100),
                    avatar TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ');
        } else {
            DB::connection($connection)->statement('
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    main_user_id INTEGER NOT NULL,
                    username VARCHAR(255),
                    name VARCHAR(255),
                    nickname VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(20),
                    email_verified_at TIMESTAMP NULL,
                    remember_token VARCHAR(100),
                    avatar TEXT,
                    credit INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (main_user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ');
        }
        
        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_users_main_user_id ON users(main_user_id)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname)
        ');
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

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS personal_access_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tokenable_type VARCHAR(255) NOT NULL,
                tokenable_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                token VARCHAR(64) UNIQUE NOT NULL,
                abilities TEXT,
                last_used_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_tokenable ON personal_access_tokens(tokenable_type, tokenable_id)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_token ON personal_access_tokens(token)
        ');
    }

    public static function ensureTTSCacheTablesExist(): array
    {
        $results = [];
        $connection = 'appqyv1';

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS app_qy_v1_tts_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text_hash VARCHAR(32) UNIQUE NOT NULL,
                text TEXT NOT NULL,
                language VARCHAR(10) NOT NULL,
                type VARCHAR(50) NOT NULL,
                voice VARCHAR(100),
                audio_path TEXT NOT NULL,
                audio_size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                access_count INTEGER DEFAULT 1
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON app_qy_v1_tts_cache(text_hash)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_tts_cache_language ON app_qy_v1_tts_cache(language)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_tts_cache_type ON app_qy_v1_tts_cache(type)
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_tts_cache_last_accessed ON app_qy_v1_tts_cache(last_accessed)
        ');

        $results['app_qy_v1_tts_cache'] = 'created';

        return $results;
    }

    public static function ensureMultiLangDictionaryTablesExist($progressCallback = null): array
    {
        $results = [];
        $connection = 'appqyv1';
        $schema = DB::connection($connection)->getSchemaBuilder();

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
                });

                $results[$tableName] = 'created';
            } else {
                $results[$tableName] = 'exists';
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
        $connection = 'appqyv1';

        $allDictTables = DB::connection($connection)
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_qy_v1_%_dictionaries' ORDER BY name");

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
            $tableName = "app_qy_v1_{$langCode}_dictionaries";

            if (isset($results[$tableName])) {
                continue;
            }

            // Create dictionary table with standardized structure
            if ($langKey === 'english') {
                DB::connection($connection)->statement("
                    CREATE TABLE IF NOT EXISTS {$tableName} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT NOT NULL,
                        md5 VARCHAR NOT NULL,
                        translations TEXT,
                        has_translation TINYINT(1) DEFAULT 0,
                        translation_provider VARCHAR,
                        phonetic TEXT,
                        us_phonetic TEXT,
                        uk_phonetic TEXT,
                        tts_files TEXT,
                        tts_provider VARCHAR,
                        image_files TEXT,
                        image_provider VARCHAR,
                        word_details TEXT,
                        is_exist_local TINYINT(1) DEFAULT 0,
                        has_operations TINYINT(1) DEFAULT 1,
                        query_count INTEGER DEFAULT 0,
                        last_modified DATETIME,
                        last_query_time DATETIME,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                ");

                DB::connection($connection)->statement("
                    CREATE UNIQUE INDEX IF NOT EXISTS unique_{$langCode}_content_md5 ON {$tableName}(content, md5)
                ");

                DB::connection($connection)->statement("
                    CREATE INDEX IF NOT EXISTS idx_{$langCode}_content ON {$tableName}(content)
                ");

                DB::connection($connection)->statement("
                    CREATE INDEX IF NOT EXISTS idx_{$langCode}_query_count ON {$tableName}(query_count)
                ");

                DB::connection($connection)->statement("
                    CREATE INDEX IF NOT EXISTS idx_{$langCode}_has_translation ON {$tableName}(has_translation)
                ");

                DB::connection($connection)->statement("
                    CREATE INDEX IF NOT EXISTS idx_{$langCode}_last_query_time ON {$tableName}(last_query_time)
                ");
            } else {
                // For other languages, use similar structure
                DB::connection($connection)->statement("
                    CREATE TABLE IF NOT EXISTS {$tableName} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT NOT NULL,
                        md5 VARCHAR NOT NULL,
                        pronunciation TEXT,
                        meaning_en TEXT,
                        meaning_zh TEXT,
                        translations TEXT,
                        has_translation TINYINT(1) DEFAULT 0,
                        phonetic TEXT,
                        tts_files TEXT,
                        image_files TEXT,
                        word_details TEXT,
                        query_count INTEGER DEFAULT 0,
                        last_query_time DATETIME,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                ");

                DB::connection($connection)->statement("
                    CREATE UNIQUE INDEX IF NOT EXISTS unique_{$langCode}_content_md5 ON {$tableName}(content, md5)
                ");

                DB::connection($connection)->statement("
                    CREATE INDEX IF NOT EXISTS idx_{$langCode}_content ON {$tableName}(content)
                ");

                DB::connection($connection)->statement("
                    CREATE INDEX IF NOT EXISTS idx_{$langCode}_has_translation ON {$tableName}(has_translation)
                ");
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
        
        $connection = 'appqyv1';
        $dataDir = base_path('init_data/AppQyV1/Multilingual_basic_data/Inspection_table');
        
        if (!is_dir($dataDir)) {
            $results['errors'][] = "Directory not found: {$dataDir}";
            return $results;
        }
        
        $mdFiles = glob("{$dataDir}/*.md");
        $results['total_files'] = count($mdFiles);
        
        $existingCount = DB::connection($connection)->table('app_qy_v1_en_dictionaries')->count();
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
                DB::connection($connection)->table('app_qy_v1_lo_dictionaries')->insert($chunk);
            }

            foreach (array_chunk($japaneseData, $chunkSize) as $chunk) {
                DB::connection($connection)->table('app_qy_v1_ja_dictionaries')->insert($chunk);
            }

            foreach (array_chunk($vietnameseData, $chunkSize) as $chunk) {
                DB::connection($connection)->table('app_qy_v1_vi_dictionaries')->insert($chunk);
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
        $connection = 'appqyv1';
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

        foreach ($batch as $item) {
            $existing = DB::connection($connection)
                ->table('app_qy_v1_en_dictionaries')
                ->where('content', $item['content'])
                ->where('md5', $item['md5'])
                ->first();

            if ($existing) {
                DB::connection($connection)
                    ->table('app_qy_v1_en_dictionaries')
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
                DB::connection($connection)
                    ->table('app_qy_v1_en_dictionaries')
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
        $connection = 'appqyv1';
        
        if (!file_exists($outputFile)) {
            return ['error' => 'output.txt not found'];
        }
        
        $existingCount = DB::connection($connection)->table('app_qy_v1_en_dictionaries')->count();
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
                DB::connection($connection)->table('app_qy_v1_en_dictionaries')->insert($batch);
                $imported += count($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            DB::connection($connection)->table('app_qy_v1_en_dictionaries')->insert($batch);
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
        $connection = 'mcpv1';

        DB::connection($connection)->statement('
            CREATE TABLE IF NOT EXISTS voice_subtitle_user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_identifier VARCHAR(100) UNIQUE NOT NULL,
                target_language TEXT DEFAULT \'["en"]\' NOT NULL,
                default_voice VARCHAR(100) DEFAULT "en-US-AriaNeural" NOT NULL,
                playback_rate DECIMAL(3,2) DEFAULT 1.0 NOT NULL,
                auto_play INTEGER DEFAULT 0 NOT NULL,
                play_mode VARCHAR(50) DEFAULT "all" NOT NULL,
                play_limit INTEGER DEFAULT 300 NOT NULL,
                play_group VARCHAR(100),
                play_language VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        DB::connection($connection)->statement('
            CREATE INDEX IF NOT EXISTS idx_voice_subtitle_user_identifier ON voice_subtitle_user_settings(user_identifier)
        ');

        $results['voice_subtitle_user_settings'] = 'created';

        return $results;
    }
}
