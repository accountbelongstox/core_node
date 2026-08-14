<?php

namespace App\Services;

use App\Models\User;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Utils\SystemArchiveManager;
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
        User::beginModelTransaction();

        try {
            $mainUser = User::createRecord($userData);
            $results['main'] = true;
            $results['main_user_id'] = $mainUser->id;

            User::commitModelTransaction();

            return [
                'success' => true,
                'user' => $mainUser,
                'sync_results' => $results,
            ];

        } catch (\Exception $e) {
            User::rollBackModelTransaction();
            
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
    
    /**
     * List tables matching a SQL-LIKE pattern using Laravel's NATIVE, driver
     * agnostic Schema builder (no raw sqlite_master / pg_catalog SQL). Returns
     * row objects each exposing a ->name property, so existing callers are
     * unchanged. Accepts a connection name or a Connection instance.
     */
    public static function listTablesLike($connection, string $likePattern): array
    {
        $connectionName = is_string($connection) ? $connection : $connection->getName();

        $names = Schema::connection($connectionName)->getTableListing();

        // Normalize possibly schema-qualified names (pgsql may return
        // "public.table") down to the bare table name.
        $names = array_map(static function ($name) {
            $pos = strrpos($name, '.');
            return $pos === false ? $name : substr($name, $pos + 1);
        }, $names);

        // Translate the SQL LIKE pattern to a shell glob (only '%' is used by our
        // callers) and filter in PHP -- keeps this fully Schema-native.
        $glob = str_replace('%', '*', $likePattern);
        $matched = array_values(array_filter($names, static fn ($name) => fnmatch($glob, $name)));
        sort($matched);

        return array_map(static fn ($name) => (object) ['name' => $name], $matched);
    }

    public static function getTableStructure(string $connection, string $tableName): array
    {
        try {
            $schema = Schema::connection($connection);

            if (!$schema->hasTable($tableName)) {
                return [];
            }

            // ONE driver-agnostic path: Laravel's native getColumns() works
            // identically on sqlite + pgsql (no PRAGMA / information_schema).
            // It returns ['name','type_name','type','nullable'(bool),'default',
            // 'auto_increment'(bool),...]; map those onto the legacy shape that
            // InitializeApps relies on: ['name','type','notnull','default','pk'].
            $primaryKeyColumns = self::primaryKeyColumns($schema, $tableName);

            $structure = [];
            foreach ($schema->getColumns($tableName) as $column) {
                $structure[] = [
                    'name' => $column['name'],
                    'type' => $column['type'] ?? ($column['type_name'] ?? ''),
                    'notnull' => empty($column['nullable']) ? 'NOT NULL' : 'NULL',
                    'default' => $column['default'] ?? null,
                    'pk' => in_array($column['name'], $primaryKeyColumns, true) ? 'PK' : '',
                ];
            }

            return $structure;
        } catch (\Exception $e) {
            Log::error("[TableStructure] Failed to get structure for {$tableName}: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Resolve the primary-key column names for a table via the native
     * getIndexes() metadata (the index flagged primary). Driver-agnostic.
     */
    private static function primaryKeyColumns($schema, string $tableName): array
    {
        foreach ($schema->getIndexes($tableName) as $index) {
            if (!empty($index['primary'])) {
                return $index['columns'] ?? [];
            }
        }

        return [];
    }

    public static function getTableIndexes(string $connection, string $tableName): array
    {
        try {
            $schema = Schema::connection($connection);

            if (!$schema->hasTable($tableName)) {
                return [];
            }

            // ONE driver-agnostic path: native getIndexes() returns
            // ['name','columns'(list),'type','unique'(bool),'primary'(bool)]
            // on both sqlite + pgsql. Map onto the legacy shape the callers
            // expect: ['name','unique','columns'(comma-joined string)].
            $indexDetails = [];
            foreach ($schema->getIndexes($tableName) as $index) {
                $indexDetails[] = [
                    'name' => $index['name'],
                    'unique' => !empty($index['unique']) ? 'UNIQUE' : '',
                    'columns' => implode(', ', $index['columns'] ?? []),
                ];
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
        $mainConnection = (string) config('database.default');
        if (self::tableExists($mainConnection, 'users')) {
            $results['Main'] = 'exists';
        } else {
            // Line 233: Table does not exist, will be created by migrations (no data deletion)
            $results['Main'] = 'skipped - will be created by migrations';
        }

        // Line 236: Check main database personal_access_tokens table (no data deletion)
        if (self::tableExists($mainConnection, 'personal_access_tokens')) {
            $results['Main (personal_access_tokens)'] = 'exists';
        } else {
            // Line 239: Table does not exist, will be created by migrations (no data deletion)
            $results['Main (personal_access_tokens)'] = 'skipped - will be created by migrations';
        }

        // Canonical-identity model: all sub-apps share the main `users` table.
        // No per-sub-app users tables exist (the old dual-write duplication was
        // removed). Report a single summary instead of per-app "skipped" lines.
        $subAppKeys = self::getSubAppKeys();
        if (!empty($subAppKeys)) {
            $appList = implode(', ', $subAppKeys);
            $results['Sub-apps (' . count($subAppKeys) . ')'] = "canonical identity — all use main users table ({$appList})";
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
            'phonetic', 'us_phonetic', 'uk_phonetic', 'tts_files', 'audio_files', 'tts_provider',
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
                    $table->json('audio_files')->nullable();
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
                // Table EXISTS (possibly with data): align structure by ADDING only the
                // missing columns via Laravel's Schema::table() ALTER. We NEVER drop or
                // recreate a populated table and NEVER modify/delete existing columns or
                // rows -- so when the code adds a new dictionary column, existing words
                // are preserved and the data-fill (補缺) flow still runs separately.
                //
                // Generic add-all-missing (NOT just has_audio): the $adders map below is
                // the canonical formal-table column spec and MUST mirror the create()
                // block above. Any required column absent from the live table is added
                // with its correct type; id/created_at/updated_at are never ALTER-added.
                $existingColumns = $schema->getColumnListing($tableName);
                $missingColumns = array_diff($requiredColumns, $existingColumns);

                if (!empty($missingColumns)) {
                    $adders = [
                        'content'              => fn ($t) => $t->text('content'),
                        'md5'                  => fn ($t) => $t->string('md5', 32)->unique(),
                        'translations'         => fn ($t) => $t->text('translations')->nullable(),
                        'has_translation'      => fn ($t) => $t->boolean('has_translation')->default(false),
                        'translation_provider' => fn ($t) => $t->string('translation_provider', 50)->nullable(),
                        'phonetic'             => fn ($t) => $t->text('phonetic')->nullable(),
                        'us_phonetic'          => fn ($t) => $t->text('us_phonetic')->nullable(),
                        'uk_phonetic'          => fn ($t) => $t->text('uk_phonetic')->nullable(),
                        'tts_files'            => fn ($t) => $t->text('tts_files')->nullable(),
                        'audio_files'          => fn ($t) => $t->json('audio_files')->nullable(),
                        'tts_provider'         => fn ($t) => $t->string('tts_provider', 50)->nullable(),
                        'has_audio'            => fn ($t) => $t->boolean('has_audio')->default(false),
                        'image_files'          => fn ($t) => $t->text('image_files')->nullable(),
                        'image_provider'       => fn ($t) => $t->string('image_provider', 50)->nullable(),
                        'word_details'         => fn ($t) => $t->text('word_details')->nullable(),
                        'is_exist_local'       => fn ($t) => $t->boolean('is_exist_local')->default(false),
                        'has_operations'       => fn ($t) => $t->boolean('has_operations')->default(false),
                        'query_count'          => fn ($t) => $t->integer('query_count')->default(0),
                        'last_modified'        => fn ($t) => $t->timestamp('last_modified')->nullable(),
                        'last_query_time'      => fn ($t) => $t->timestamp('last_query_time')->nullable(),
                    ];
                    $schema->table($tableName, function ($table) use ($missingColumns, $adders) {
                        foreach ($missingColumns as $col) {
                            if (isset($adders[$col])) {
                                $adders[$col]($table);
                            }
                        }
                    });
                    // Add single-column indexes for any newly added indexable columns
                    // (idempotent: hasIndex guard; best-effort across drivers).
                    foreach (['has_audio', 'content', 'has_translation'] as $idxCol) {
                        if (in_array($idxCol, $missingColumns, true)) {
                            try {
                                if (!$schema->hasIndex($tableName, [$idxCol])) {
                                    $schema->table($tableName, fn ($t) => $t->index($idxCol));
                                }
                            } catch (\Throwable $e) {
                                // index alignment is best-effort; never fail init over it
                            }
                        }
                    }
                    $results[$tableName] = 'updated';
                } else {
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
            $results['reason'] = 'already_staged';
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
                // PHP bool (not 1/0): target column is BOOLEAN on pgsql.
                $foldedHasTranslation = (!empty($meaningZh) || !empty($meaningEn));

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
            return ['lang' => $langCode, 'skipped' => true, 'reason' => 'missing_table', 'message' => "{$langCode}: staging or formal table missing"];
        }

        $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
        $db = $model->getConnection();

        $inserted = 0;
        $enriched = 0;
        $processed = 0;
        $chunkNo = 0;
        $stagingTotal = (int) $db->table($staging)->count();
        $now = now();

        // IDEMPOTENCY FAST-PATH (avoids re-scanning the whole staging table on every
        // sys:init re-run -- e.g. EN's 233k rows). When the staging set is already
        // fully promoted + enriched there is nothing to do; detect that with two
        // cheap INDEXED queries instead of the PHP chunk loop below:
        //   (a) insert pending  = any staging md5 absent from formal;
        //   (b) enrich pending  = any matched row whose formal copy still lacks a
        //       field the staging row provides -- mirrors the per-row predicate in
        //       the loop EXACTLY (translation / phonetic / us / uk / image_files).
        // If neither, skip the scan. md5 is UNIQUE-indexed on formal, so both are
        // fast even when they must confirm "no work".
        if ($stagingTotal > 0) {
            $insertPending = $db->table("{$staging} as s")
                ->whereNotExists(function ($q) use ($db, $formal) {
                    $q->select($db->raw('1'))->from("{$formal} as f")->whereColumn('f.md5', 's.md5');
                })->exists();

            $enrichPending = false;
            if (!$insertPending) {
                // Mirror the loop's PHP semantics EXACTLY so the gate never wrongly
                // skips: the loop uses empty() (null, '' AND '0' are all "empty") and
                // (int)$x===0 (null/''/0 -> 0). So the FORMAL-side "lacks it" check must
                // include NULL and '0', and the STAGING-side "has it" must exclude '0'.
                $enrichPending = $db->table("{$staging} as s")
                    ->join("{$formal} as f", 'f.md5', '=', 's.md5')
                    ->where(function ($w) {
                        $w->where(function ($x) {
                            $x->where(function ($y) { $y->where('f.has_translation', false)->orWhereNull('f.has_translation'); })
                                ->where('s.has_translation', true);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.phonetic')->orWhereIn('f.phonetic', ['', '0']); })
                                ->whereNotNull('s.phonetic')->whereNotIn('s.phonetic', ['', '0']);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.us_phonetic')->orWhereIn('f.us_phonetic', ['', '0']); })
                                ->whereNotNull('s.us_phonetic')->whereNotIn('s.us_phonetic', ['', '0']);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.uk_phonetic')->orWhereIn('f.uk_phonetic', ['', '0']); })
                                ->whereNotNull('s.uk_phonetic')->whereNotIn('s.uk_phonetic', ['', '0']);
                        })->orWhere(function ($x) {
                            $x->where(function ($y) { $y->whereNull('f.image_files')->orWhereIn('f.image_files', ['', '0']); })
                                ->whereNotNull('s.image_files')->whereNotIn('s.image_files', ['', '0']);
                        });
                    })->exists();
            }

            if (!$insertPending && !$enrichPending) {
                if (PHP_SAPI === 'cli') {
                    echo "      [Step2 promote staging->formal:{$langCode}] up-to-date ({$stagingTotal} staged rows already in formal table) -> skip\n";
                    flush();
                }
                return ['lang' => $langCode, 'skipped' => true, 'reason' => 'already_promoted', 'staging' => $stagingTotal, 'message' => "{$langCode}: {$stagingTotal} staged rows already promoted"];
            }
        }

        // Per-chunk set-based promotion (formal.md5 is UNIQUE):
        //   1 SELECT (whereIn the chunk md5s) + 1 batch insertOrIgnore for
        //   absent rows + at most a small number of enrich UPDATEs (only rows
        //   that genuinely gained a translation/phonetic). Replaces the prior
        //   per-row SELECT+INSERT (~2 queries/row) which was O(rows) and made
        //   re-init very slow on large tables (e.g. EN 100k+).
        $db->table($staging)->orderBy('id')->chunk(1000, function ($rows) use ($db, $formal, &$inserted, &$enriched, &$processed, &$chunkNo, $stagingTotal, $now, $langCode) {
            $chunkMd5s = [];
            foreach ($rows as $row) {
                $chunkMd5s[] = $row->md5;
            }
            if (empty($chunkMd5s)) {
                return;
            }

            $existingByMd5 = [];
            foreach ($db->table($formal)->whereIn('md5', $chunkMd5s)->get(['id', 'md5', 'has_translation', 'phonetic', 'us_phonetic', 'uk_phonetic', 'image_files']) as $ex) {
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
                        'has_audio' => isset($row->has_audio) ? $row->has_audio : false,
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
                if (empty($existing->us_phonetic) && isset($row->us_phonetic) && !empty($row->us_phonetic)) {
                    $update['us_phonetic'] = $row->us_phonetic;
                }
                if (empty($existing->uk_phonetic) && isset($row->uk_phonetic) && !empty($row->uk_phonetic)) {
                    $update['uk_phonetic'] = $row->uk_phonetic;
                }
                if (empty($existing->image_files) && isset($row->image_files) && !empty($row->image_files)) {
                    $update['image_files'] = $row->image_files;
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

            // Real-time progress so promotion never looks "stuck" on large tables
            // (e.g. EN 100k+). Show the ROWS-PROCESSED counter -- inserted/enriched
            // stay 0 on an idempotent re-run, so they alone look frozen. Throttled
            // newline output (every 10 chunks) so it is visible in captured logs too
            // (a bare \r does not advance when stdout is redirected to a file).
            $processed += count($rows);
            $chunkNo++;
            if (PHP_SAPI === 'cli' && ($chunkNo % 10 === 0)) {
                echo "      [Step2 promote staging->formal:{$langCode}] staging->formal {$processed}/{$stagingTotal} (inserted into formal {$inserted}, enriched existing {$enriched})...\n";
                flush();
            }
        });

        if (PHP_SAPI === 'cli') {
            echo "      [Step2 promote staging->formal:{$langCode}] staging->formal {$processed}/{$stagingTotal} (inserted into formal {$inserted}, enriched existing {$enriched}) (done)\n";
            flush();
        }

        // Promotion changed row count and/or translation coverage -> invalidate
        // the cached dashboard dictionary metrics for this language.
        if ($inserted > 0 || $enriched > 0) {
            \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel::forgetMetricsCache($langCode);
        }

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

        // Idempotency short-circuit: if the EN staging table already holds translated
        // rows, the (expensive, ~200k per-row) upsert ran on a prior init -> skip it
        // and let promoteStagingToFormal (idempotent insertOrIgnore) finish. Without
        // this, a run interrupted before promotion re-imports everything because the
        // handle() gate keys on the FORMAL table's translation count, not staging.
        try {
            $enStaging = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('en');
            $model = new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel();
            $db = $model->getConnection();
            if (Schema::connection($db->getName())->hasTable($enStaging)
                && $db->table($enStaging)->where('has_translation', true)->exists()) {
                return [
                    'skipped' => true,
                    'reason' => 'already_imported',
                    'message' => 'EN staging already has translated rows; skipping JSON re-import',
                ];
            }
        } catch (\Throwable $e) {
            // If the probe fails, fall through and import normally.
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
                    'has_translation' => !empty($translation),
                ];
                
                $processed++;
                
                if (count($batch) >= $batchSize) {
                    $result = self::upsertTranslationBatch($connection, $batch);
                    $updated += $result['updated'];
                    $inserted += $result['inserted'];
                    $batch = [];
                    // Real-time progress (throttled newline; visible in captured logs).
                    if (PHP_SAPI === 'cli' && $processed % 10000 === 0) {
                        echo "      [Step2 load->staging:translations] enriching staging table: processed {$processed} (updated {$updated}, inserted {$inserted}; still staging, not formal)...\n";
                        flush();
                    }
                }
            }
        }

        if (!empty($batch)) {
            $result = self::upsertTranslationBatch($connection, $batch);
            $updated += $result['updated'];
            $inserted += $result['inserted'];
        }

        fclose($handle);

        if (PHP_SAPI === 'cli') {
            echo "      [Step2 load->staging:translations] enriched staging table: processed {$processed} (updated {$updated}, inserted {$inserted}) (done; promote step moves them to formal)\n";
            flush();
        }
        
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
                'reason' => 'already_extracted',
                'message' => 'JSON already extracted',
                'json_file' => $jsonFile,
                'json_size' => filesize($jsonFile),
            ];
        }

        // The translation source ships as a split 7z archive; extraction needs an
        // external 7z binary (p7zip). PHP has no native 7z reader, so if the
        // binary is missing we must FAIL LOUDLY here -- previously this fell
        // through to a hardcoded `7z` exec that silently failed, dropping every
        // translation and leaving the dictionary at has_translation=0.
        $sevenZipBin = SystemArchiveManager::executable();
        if ($sevenZipBin === null) {
            $msg = '7z binary not found (p7zip). Dictionary translations cannot be extracted. '
                . 'Install it: Debian/Ubuntu/WSL -> sudo apt-get install -y p7zip-full '
                . '(or run scripts/shells/linux/debian/install_shells/43_install_p7zip.sh).';
            Log::error('[DictionaryInit] ' . $msg);
            return [
                'error' => $msg,
                'missing_dependency' => '7z',
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

            // Concatenate the split parts in PHP (portable; no shell `cat`
            // dependency, works on Windows too). Parts are zero-padded
            // (olddb.7z.001..NNN) so a natural sort yields the correct order.
            $parts = glob("{$tmpDir}/olddb.7z.*");
            if ($parts === false) {
                $parts = [];
            }
            natsort($parts);

            $combined = false;
            $out = fopen($combinedFile, 'wb');
            if ($out !== false) {
                $combined = true;
                foreach ($parts as $part) {
                    $in = fopen($part, 'rb');
                    if ($in === false) {
                        $combined = false;
                        $results['errors'][] = "Failed to read part: " . basename($part);
                        break;
                    }
                    stream_copy_to_stream($in, $out);
                    fclose($in);
                }
                fclose($out);
            } else {
                $results['errors'][] = "Failed to open combined archive for writing: {$combinedFile}";
            }

            if ($combined && file_exists($combinedFile)) {
                if (!is_dir($extractDir)) {
                    mkdir($extractDir, 0755, true);
                }

                try {
                    SystemArchiveManager::extract7z($combinedFile, $extractDir);
                    $results['extracted'] = 1;
                    $results['extract_dir'] = $extractDir;

                    if (file_exists($jsonFile)) {
                        $results['json_file'] = $jsonFile;
                        $results['json_size'] = filesize($jsonFile);
                    }
                } catch (\Throwable $exception) {
                    $results['errors'][] = 'Failed to extract: ' . $exception->getMessage();
                }
            } else {
                $results['errors'][] = "Failed to combine parts into {$combinedFile}";
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
        
        // Stage 1: import into the staging table. Idempotency: gate on ANY staged
        // rows ("> 0"), matching importMultilingualWordsFromMd. The staging md5 is a
        // non-unique index, so a plain insert here would duplicate rows if a prior
        // run was interrupted after staging some (but < the old magic 50000) words;
        // gating on > 0 closes that window. promoteStagingToFormal still dedups by
        // md5 (insertOrIgnore) on the way into the formal table.
        $enStagingTable = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getDictionaryStagingTableName('en');
        $existingCount = $dbConnection->table($enStagingTable)->count();
        if ($existingCount > 0) {
            return [
                'skipped' => true,
                'reason' => 'already_staged',
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
                'has_translation' => false,
                'query_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($batch) >= 1000) {
                // Use model connection for query builder (Stage-1 staging)
                $dbConnection->table($enStagingTable)->insert($batch);
                $imported += count($batch);
                $batch = [];
                // Real-time progress (throttled newline; visible in captured logs).
                if (PHP_SAPI === 'cli' && ($imported % 10000 === 0)) {
                    echo "      [Step2 load->staging:words] loaded {$imported} words into staging table (not yet in formal)...\n";
                    flush();
                }
            }
        }

        if (!empty($batch)) {
            // Use model connection for query builder (Stage-1 staging)
            $dbConnection->table($enStagingTable)->insert($batch);
            $imported += count($batch);
        }

        fclose($handle);

        if (PHP_SAPI === 'cli') {
            echo "      [Step2 load->staging:words] loaded {$imported} words into staging table (done; promote step moves them to formal)\n";
            flush();
        }

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
