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
        
        // Canonical-identity model: the user exists ONCE in the main `users`
        // table. There is no fan-out write to per-sub-app `users` tables
        // (that duplication is removed). Kept for backward compatibility.
        DB::beginTransaction();

        try {
            $mainUser = User::create($userData);
            $results['main'] = true;
            $results['main_user_id'] = $mainUser->id;

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
    
    /**
     * Ensure user tables exist with correct structure (no data deletion)
     * 
     * Table structure alignment strategy:
     * 1. If table does not exist: Create table (no data deletion, table doesn't exist)
     * 2. If table exists: Skip (no data deletion, no modification to existing table structure)
     * 
     * IMPORTANT: This method NEVER deletes tables or data, only creates non-existent tables
     */
    public static function ensureUserTablesExist(): array
    {
        $results = [];

        // Line 230: Check main database users table (no data deletion)
        if (self::tableExists('sqlite', 'users')) {
            $results['Main'] = 'exists';
        } else {
            // Line 233: Table does not exist, will be created by migrations (no data deletion)
            $results['Main'] = 'skipped - will be created by migrations';
        }

        // Line 236: Check main database personal_access_tokens table (no data deletion)
        if (self::tableExists('sqlite', 'personal_access_tokens')) {
            $results['Main (personal_access_tokens)'] = 'exists';
        } else {
            // Line 239: Table does not exist, will be created by migrations (no data deletion)
            $results['Main (personal_access_tokens)'] = 'skipped - will be created by migrations';
        }

        // Canonical-identity model: there are NO per-sub-app `users` tables.
        // Identity lives ONCE in the main `users` table; app-specific user
        // fields live in per-app extension tables keyed by main_user_id.
        // Sub-app users tables are intentionally NOT created here (the old
        // dual-write/duplication produced non-ACID cross-file writes and the
        // registration FK failure). Any pre-existing duplicate sub-app `users`
        // tables are removed by the drop-orphan-subapp-users migration.
        foreach (self::getSubAppKeys() as $appKey) {
            $results[$appKey] = 'skipped - canonical identity (no per-app users table)';
        }

        return $results;
    }
    
    /**
     * Create user table (no data deletion)
     * 
     * IMPORTANT: This method only creates table if it doesn't exist, returns immediately if table exists
     * NEVER deletes tables or data
     */
    /**
     * DEPRECATED / DISABLED. The canonical-identity refactor removed per-sub-app
     * duplicate `users` tables. This method must never recreate one (doing so
     * reintroduced the cross-file self-FK that broke registration). Kept as a
     * guarded no-op for backward compatibility; it has no callers.
     */
    private static function createUserTable(string $connection): void
    {
        Log::warning("[UserSync] createUserTable('{$connection}') is disabled: "
            . 'per-sub-app users tables were removed (canonical-identity model). No-op.');
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

    /**
     * Ensure TTS cache table exists with correct structure (no data deletion)
     * 
     * Table structure alignment strategy:
     * 1. If table does not exist: Create table (no data deletion, table doesn't exist)
     * 2. If table exists: Skip (no data deletion, no modification to existing table structure)
     * 
     * IMPORTANT: This method NEVER deletes tables or data, only creates non-existent tables
     */
    public static function ensureTTSCacheTablesExist(): array
    {
        $results = [];
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'tts_cache');

        // Line 387: Check if table exists - if exists, skip (no data deletion)
        if (Schema::connection($connection)->hasTable($tableName)) {
            $results[$tableName] = 'exists';
            return $results;
        }

        // Line 393: Table does not exist, create it (no data deletion, table doesn't exist)
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

    /**
     * Ensure multilingual dictionary tables exist with correct structure (no data deletion)
     * 
     * Table structure alignment strategy:
     * 1. If table does not exist: Create table (no data deletion, table doesn't exist)
     * 2. If table exists but missing columns: Add missing columns (no data deletion)
     * 3. If table exists with correct structure: Skip (no data deletion)
     * 
     * IMPORTANT: This method NEVER deletes tables or data, only adds missing columns
     */
    public static function ensureMultiLangDictionaryTablesExist($progressCallback = null): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $schema = Schema::connection($connection);

        $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();
        $total = count($supportedLanguages);
        $current = 0;

        // Line 439: Define all required columns (for checking table structure completeness)
        $requiredColumns = [
            'id', 'content', 'md5', 'translations', 'has_translation', 'translation_provider',
            'phonetic', 'us_phonetic', 'uk_phonetic', 'tts_files', 'tts_provider',
            'has_audio', 'image_files', 'image_provider', 'word_details',
            'is_exist_local', 'has_operations', 'query_count',
            'last_modified', 'last_query_time', 'created_at', 'updated_at'
        ];

        foreach ($supportedLanguages as $langCode) {
            $current++;
            $tableName = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName($langCode);

            // Line 452: If table does not exist, create it (no data deletion, table doesn't exist)
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
                // Line 481: Table exists, check and add missing columns (no data deletion)
                $existingColumns = $schema->getColumnListing($tableName);
                $missingColumns = array_diff($requiredColumns, $existingColumns);
                
                if (!empty($missingColumns)) {
                    // Line 485: Add missing columns (no data deletion)
                    $schema->table($tableName, function ($table) use ($missingColumns, $existingColumns) {
                        // Line 487: Add has_audio column if missing
                        if (in_array('has_audio', $missingColumns)) {
                            $table->boolean('has_audio')->default(false)->after('tts_provider');
                            $table->index('has_audio');
                        }
                        // Note: Only add columns, never delete columns, never modify existing columns
                    });
                    $results[$tableName] = 'migrated';
                } else {
                    // Line 495: Table structure is complete, skip
                    $results[$tableName] = 'exists';
                }
            }

            // Stage-1 staging table (md5 indexed, not unique - import may
            // produce duplicate md5 across files; promotion dedups).
            $stagingTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName($langCode);
            if (!$schema->hasTable($stagingTable)) {
                $schema->create($stagingTable, function ($table) {
                    $table->increments('id');
                    $table->text('content');
                    $table->string('md5', 32)->index();
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

                    $table->index('content');
                });
                $results[$stagingTable] = 'created';
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

    /**
     * Ensure multilingual word tables exist with correct structure (no data deletion)
     * 
     * Table structure alignment strategy:
     * 1. If table does not exist: Create table (no data deletion, table doesn't exist)
     * 2. If table exists: Skip (no data deletion, no modification to existing table structure)
     * 
     * IMPORTANT: This method NEVER deletes tables or data, only creates non-existent tables
     */
    public static function ensureMultilingualWordTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $dbConnection = $model->getConnection();

        // Line 536: Get all existing dictionary tables (these tables will not be deleted)
        $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $pattern = $prefix . '_%_dictionaries';
        $allDictTables = $dbConnection
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name", [$pattern]);

        // Line 542: Mark all existing tables (these tables will not be deleted)
        foreach ($allDictTables as $tableObj) {
            $tableName = $tableObj->name;
            $results[$tableName] = 'exists';
        }

        // Line 548: Define language tables that need to be created
        $languages = [
            'lao' => ['lo', 'Lao'],
            'japanese' => ['ja', 'Japanese'],
            'vietnamese' => ['vi', 'Vietnamese'],
            'english' => ['en', 'English'],
        ];

        foreach ($languages as $langKey => $langInfo) {
            list($langCode, $langName) = $langInfo;
            $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, "{$langCode}_dictionaries");

            // Line 560: If table is already in results (exists), skip (no data deletion)
            if (isset($results[$tableName])) {
                continue;
            }

            // Line 565: If table exists, mark as exists (no data deletion)
            if (Schema::connection($connection)->hasTable($tableName)) {
                $results[$tableName] = 'exists';
                continue;
            }

            // Line 571: Table does not exist, create it (no data deletion, table doesn't exist)
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
                // Line 590: For other languages, use similar structure (no data deletion)
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
        
        // Gate on the lo staging table (this importer targets lo/ja/vi).
        $loStagingTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('lo');
        $existingCount = $dbConnection->table($loStagingTable)->count();
        if ($existingCount > 0) {
            $results['skipped'] = true;
            $results['message'] = "Staging already has {$existingCount} records, skipping import";
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
                
                
                // Fold legacy pronunciation/meaning_* into the unified schema:
                // phonetic <- pronunciation, translations <- {en,zh} JSON.
                $foldedTranslations = json_encode(['en' => $meaningEn, 'zh' => $meaningZh], JSON_UNESCAPED_UNICODE);
                $foldedHasTranslation = (!empty($meaningZh) || !empty($meaningEn)) ? 1 : 0;

                $laoData[] = [
                    'content' => $lao,
                    'md5' => md5($lao),
                    'phonetic' => $laoPronunciation,
                    'translations' => $foldedTranslations,
                    'has_translation' => $foldedHasTranslation,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $japaneseData[] = [
                    'content' => $japanese,
                    'md5' => md5($japanese),
                    'phonetic' => $japanesePronunciation,
                    'translations' => $foldedTranslations,
                    'has_translation' => $foldedHasTranslation,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $vietnameseData[] = [
                    'content' => $vietnamese,
                    'md5' => md5($vietnamese),
                    'phonetic' => $vietnamesePronunciation,
                    'translations' => $foldedTranslations,
                    'has_translation' => $foldedHasTranslation,
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
                $loStaging = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('lo');
                $dbConnection->table($loStaging)->insert($chunk);
            }

            foreach (array_chunk($japaneseData, $chunkSize) as $chunk) {
                $jaStaging = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('ja');
                $dbConnection->table($jaStaging)->insert($chunk);
            }

            foreach (array_chunk($vietnameseData, $chunkSize) as $chunk) {
                $viStaging = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('vi');
                $dbConnection->table($viStaging)->insert($chunk);
            }

            $results['imported'] = $results['total_words'];

            // Stage 2: promote lo/ja/vi staging into the formal tts_cache_{lang}
            // tables immediately. This importer runs every sys:init (it is not
            // inside the skip-gated dictionary Step 2), so promotion must also
            // run here or freshly staged lo/ja/vi rows would never reach formal.
            $results['promote'] = [
                'lo' => self::promoteStagingToFormal('lo'),
                'ja' => self::promoteStagingToFormal('ja'),
                'vi' => self::promoteStagingToFormal('vi'),
            ];

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
            // Stage 2: promote every language's staging rows into the formal
            // canonical tts_cache_{lang} tables (idempotent, additive).
            $results['step5_promote'] = self::promoteAllStaging();

        } catch (\Exception $e) {
            Log::error("[DictionaryInit] Failed: " . $e->getMessage());
            $results['error'] = $e->getMessage();
        }

        return $results;
    }

    /**
     * Stage 2: copy rows from a language's staging table into its formal
     * tts_cache_{lang} table. Idempotent and additive: inserts rows whose md5
     * is absent from the formal table, and enriches existing formal rows that
     * still lack a translation/audio when staging has richer data. Never
     * deletes formal rows.
     */
    public static function promoteStagingToFormal(string $langCode): array
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $schema = Schema::connection($connection);

        $staging = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName($langCode);
        $formal = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryTableName($langCode);

        if (!$schema->hasTable($staging) || !$schema->hasTable($formal)) {
            return ['lang' => $langCode, 'skipped' => true, 'reason' => 'missing_table'];
        }

        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $db = $model->getConnection();

        $inserted = 0;
        $enriched = 0;
        $now = now();

        // Per-chunk set-based promotion (formal.md5 is UNIQUE):
        //   1 SELECT (whereIn the chunk md5s) + 1 batch insertOrIgnore for
        //   absent rows + at most a small number of enrich UPDATEs (only rows
        //   that genuinely gained a translation/phonetic). Replaces the prior
        //   per-row SELECT+INSERT (~2 queries/row) which was O(rows) and made
        //   re-init very slow on large tables (e.g. EN 100k+).
        $db->table($staging)->orderBy('id')->chunk(1000, function ($rows) use ($db, $formal, &$inserted, &$enriched, $now) {
            $chunkMd5s = [];
            foreach ($rows as $row) {
                $chunkMd5s[] = $row->md5;
            }
            if (empty($chunkMd5s)) {
                return;
            }

            $existingByMd5 = [];
            foreach ($db->table($formal)->whereIn('md5', $chunkMd5s)->get(['id', 'md5', 'has_translation', 'phonetic']) as $ex) {
                $existingByMd5[$ex->md5] = $ex;
            }

            $insertBatch = [];
            $seenInBatch = [];
            foreach ($rows as $row) {
                if (!isset($existingByMd5[$row->md5])) {
                    // Dedup within the staging chunk itself (md5 is not unique
                    // in staging); insertOrIgnore also guards against races.
                    if (isset($seenInBatch[$row->md5])) {
                        continue;
                    }
                    $seenInBatch[$row->md5] = true;
                    $insertBatch[] = [
                        'content' => $row->content,
                        'md5' => $row->md5,
                        'translations' => $row->translations,
                        'has_translation' => $row->has_translation,
                        'phonetic' => $row->phonetic,
                        'us_phonetic' => isset($row->us_phonetic) ? $row->us_phonetic : null,
                        'uk_phonetic' => isset($row->uk_phonetic) ? $row->uk_phonetic : null,
                        'tts_files' => isset($row->tts_files) ? $row->tts_files : null,
                        'image_files' => isset($row->image_files) ? $row->image_files : null,
                        'has_audio' => isset($row->has_audio) ? $row->has_audio : 0,
                        'query_count' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                    continue;
                }

                $existing = $existingByMd5[$row->md5];
                $update = [];
                $existingHasTranslation = isset($existing->has_translation) ? (int) $existing->has_translation : 0;
                if ($existingHasTranslation === 0 && (int) $row->has_translation === 1) {
                    $update['translations'] = $row->translations;
                    $update['has_translation'] = 1;
                }
                if (empty($existing->phonetic) && !empty($row->phonetic)) {
                    $update['phonetic'] = $row->phonetic;
                }
                if (!empty($update)) {
                    $update['updated_at'] = $now;
                    $db->table($formal)->where('id', $existing->id)->update($update);
                    $enriched++;
                }
            }

            if (!empty($insertBatch)) {
                $db->table($formal)->insertOrIgnore($insertBatch);
                $inserted += count($insertBatch);
            }
        });

        return ['lang' => $langCode, 'inserted' => $inserted, 'enriched' => $enriched];
    }

    /**
     * Stage 2 for every supported language.
     */
    public static function promoteAllStaging(): array
    {
        $results = [];
        $languages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();
        foreach ($languages as $langCode) {
            $results[$langCode] = self::promoteStagingToFormal($langCode);
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
            // Stage 1: translations are written into the EN staging table;
            // promoteStagingToFormal('en') merges them into the formal table.
            $enDictTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('en');
            $existing = $dbConnection
                ->table($enDictTable)
                ->where('content', $item['content'])
                ->where('md5', $item['md5'])
                ->first();

            if ($existing) {
                $shouldUpdate = false;
                if (!isset($existing->has_translation) || (int) $existing->has_translation === 0) {
                    $shouldUpdate = true;
                } elseif (empty($existing->translations)) {
                    $shouldUpdate = true;
                }

                if ($shouldUpdate) {
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
                }
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
        
        // Stage 1: import into the staging table (gate on staging count so a
        // fresh install with an empty formal table still imports).
        $enStagingTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('en');
        $existingCount = $dbConnection->table($enStagingTable)->count();
        if ($existingCount > 50000) {
            return [
                'skipped' => true,
                'message' => "Already staged {$existingCount} words, skipping",
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
                // Use model connection for query builder (Stage-1 staging)
                $dbConnection->table($enStagingTable)->insert($batch);
                $imported += count($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            // Use model connection for query builder (Stage-1 staging)
            $dbConnection->table($enStagingTable)->insert($batch);
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
