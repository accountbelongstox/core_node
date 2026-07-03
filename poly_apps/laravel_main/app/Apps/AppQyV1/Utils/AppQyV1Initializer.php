<?php

namespace App\Apps\AppQyV1\Utils;

use App\Contracts\AppInitializerInterface;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class AppQyV1Initializer implements AppInitializerInterface
{
    private $statusFile;
    
    const INITIALIZATION_STEPS = [
        'database_connection' => 'Check database connection',
        'create_database_file' => 'Create database file if not exists',
        'run_migrations' => 'Run database migrations',
        'verify_tables' => 'Verify all tables created',
        'create_indexes' => 'Create database indexes',
        'seed_initial_data' => 'Seed initial data if needed',
        'seed_books' => 'Seed initial book list (shipped corpus)',
        'seed_ai_prompts' => 'Seed AI prompt library defaults',
    ];
    
    public function __construct()
    {
        $dbDir = \App\Providers\PathMapper::getLaravelDatabaseDir();
        if (!$dbDir) {
            Log::error('[AppQyV1Initializer] Laravel database directory not found');
            return;
        }
        
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }
        
        $appKey = AppKeys::APPQYV1;
        $tablePrefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }
    
    public function getAppName(): string
    {
        return 'AppQyV1';
    }
    
    public function initialize(bool $force = false): array
    {
        // Drain orphaned external data from the legacy storage_path location
        // into the canonical mapWebPath-backed root BEFORE markers/data are
        // checked or written, so flags and media co-locate in the new root.
        // Safe (OLD kept on any failure), idempotent (guard + skip-if-exists),
        // cross-OS (Laravel File + PathMapper). Same namespace - no use needed.
        try {
            AppQyV1ExternalDataMigrator::migrate();
        } catch (\Throwable $e) {
            Log::error('[AppQyV1Init] External data migration error: ' . $e->getMessage());
        }

        // Pre-create the unified external/static storage tree (incl. the new
        // static/app_qy_v1/audio base) so the write-back target and serve route
        // share one pre-existing root from the very first request.
        try {
            (new \App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager())
                ->ensureDirectoryStructure();
        } catch (\Throwable $e) {
            Log::error('[AppQyV1Init] ensureDirectoryStructure error: ' . $e->getMessage());
        }

        // Idempotently COPY (never move/delete) legacy word/sentence-TTS audio
        // from tts_data/audio/** and external_data/audio/** into the new
        // static/app_qy_v1/audio/** tree at the SAME relative path, so files
        // produced under the old base stay readable after the Phase-1 move.
        // Sentinel-guarded -> runs once. Same namespace - no use needed.
        try {
            AppQyV1AudioStaticMigrator::migrate();
        } catch (\Throwable $e) {
            Log::error('[AppQyV1Init] Audio static migration error: ' . $e->getMessage());
        }

        $status = $this->loadStatus();
        $results = [];
        $allSuccess = true;
        
        foreach (self::INITIALIZATION_STEPS as $step => $description) {
            // The completed_steps flag lives in a filesystem status file, independent
            // of the (per-app) database. If the DB was externally reset/recreated
            // empty, the flag would lie. stepStillSatisfiedInDb() re-checks the live
            // DB for data-bearing steps so we never wrongly skip them -> eliminates
            // the status-file vs database divergence.
            $statusSaysDone = !$force
                && isset($status['completed_steps'][$step])
                && $status['completed_steps'][$step] === true;

            if ($statusSaysDone && $this->stepStillSatisfiedInDb($step)) {
                $results[$step] = [
                    'status' => 'skipped',
                    'message' => 'Already completed',
                    'description' => $description,
                ];
                continue;
            }
            
            Log::info("[AppQyV1Init] Running step: {$step} - {$description}");
            if (PHP_SAPI === 'cli') {
                echo "    [AppQyV1] Step {$step}: {$description}...\n";
            }
            
            try {
                $result = $this->executeStep($step);
                $results[$step] = array_merge($result, ['description' => $description]);
                
                $statusCode = $result['status'] ?? 'error';
                
                if ($statusCode === 'success') {
                    $this->markStepCompleted($step);
                    // verify_tables only returns success when every dictionary
                    // table exists, so this is the authoritative "database is
                    // ready" signal that the runtime read-side checks for.
                    if ($step === 'verify_tables') {
                        (new AppQyV1InitializationMarkerManager())->setDatabaseProcessed();
                    }
                    if (PHP_SAPI === 'cli') {
                        echo "      -> OK: {$result['message']}\n";
                        // For seed_initial_data, print per-collection details for better visibility.
                        if ($step === 'seed_initial_data' && isset($result['details']) && is_array($result['details'])) {
                            foreach ($result['details'] as $name => $detail) {
                                if (!is_array($detail)) {
                                    continue;
                                }
                                $statusLabel = ($detail['success'] ?? false) ? 'OK' : 'FAIL';
                                $totalWords = $detail['total_words'] ?? 0;
                                $ensured = $detail['ensured_in_dictionary'] ?? 0;
                                echo sprintf(
                                    "         • [%s] %s: %d words (ensured in dictionary: %d)\n",
                                    $statusLabel,
                                    $name,
                                    $totalWords,
                                    $ensured
                                );
                            }
                        }
                    }
                } elseif ($statusCode === 'error') {
                    $allSuccess = false;
                    if (PHP_SAPI === 'cli') {
                        $msg = $result['message'] ?? 'Unknown error';
                        echo "      -> {$result['status']}: {$msg}\n";
                    }
                    if (!$force) {
                        break;
                    }
                }
            } catch (\Exception $e) {
                $results[$step] = [
                    'status' => 'error',
                    'message' => $e->getMessage(),
                    'description' => $description,
                    'exception' => get_class($e),
                ];
                $allSuccess = false;
                
                if (PHP_SAPI === 'cli') {
                    echo "      -> EXCEPTION: {$e->getMessage()}\n";
                }
                
                if (!$force) {
                    break;
                }
            }
        }
        
        if ($allSuccess) {
            $this->markFullyInitialized();

            // Write the runtime initialization markers that the AppQyV1
            // controllers check before serving dictionary data. AppQyV1 has no
            // audio/image processing step (media is served on demand), so those
            // markers are recorded here together with the completion marker.
            $markerManager = new AppQyV1InitializationMarkerManager();
            $markerManager->setDatabaseProcessed();
            $markerManager->setAudioProcessed();
            $markerManager->setImagesProcessed();
            $markerManager->setInitializationComplete();

            // Stage-2 safety net: promote any staged rows for every language
            // into the formal tts_cache_{lang} tables. Runs on every init
            // regardless of the skip-gated dictionary Step 2, so re-inits never
            // leave staged data unpromoted. Idempotent and additive.
            try {
                \App\Services\UserSyncService::promoteAllStaging();
            } catch (\Throwable $e) {
                Log::error('[AppQyV1Init] promoteAllStaging error: ' . $e->getMessage());
            }
        }

        // SELF-HEAL: rebuild STRANDED v2 books (full_content present but no
        // source_sentences — sentences lost when the shared app_qy_v1_sentences
        // table was dropped). Runs on EVERY init (NOT marker-gated), is CHEAP
        // when nothing's stranded (one exists() query then skip), SELF-SKIPPING
        // afterwards (a rebuilt book HAS source_sentences so it no longer matches
        // — the data state is the guard, no marker needed), FILL-MISSING via
        // MediaIngestService::ingest (a partial prior run converges next time),
        // and BEST-EFFORT (try/catch — a rebuild failure must never break init).
        try {
            if (\App\Console\Commands\AppQyV1RebuildStrandedBooks::hasStranded()) {
                $repair = \App\Console\Commands\AppQyV1RebuildStrandedBooks::rebuild(null, false, null);
                Log::info('[AppQyV1Init] stranded-book self-heal', $repair);
                $results['repair_stranded_books'] = [
                    'status' => 'success',
                    'message' => sprintf(
                        'Rebuilt %d stranded book(s) (skipped_unrecoverable=%d, failed=%d)',
                        $repair['rebuilt'],
                        $repair['skipped_unrecoverable'],
                        $repair['failed']
                    ),
                    'description' => 'Rebuild stranded v2 books from full_content',
                ];
                if (PHP_SAPI === 'cli') {
                    echo "    [AppQyV1] Self-heal: {$results['repair_stranded_books']['message']}\n";
                }
            } else {
                $results['repair_stranded_books'] = [
                    'status' => 'skipped',
                    'message' => 'No stranded books',
                    'description' => 'Rebuild stranded v2 books from full_content',
                ];
            }
        } catch (\Throwable $e) {
            // Never break init on a repair failure.
            Log::error('[AppQyV1Init] stranded-book self-heal error: ' . $e->getMessage());
            $results['repair_stranded_books'] = [
                'status' => 'error',
                'message' => $e->getMessage(),
                'description' => 'Rebuild stranded v2 books from full_content',
            ];
        }

        return [
            'success' => $allSuccess,
            'app' => $this->getAppName(),
            'steps' => $results,
            'fully_initialized' => $allSuccess,
            'timestamp' => now()->toDateTimeString(),
        ];
    }
    
    /**
     * For data-bearing steps, re-verify the live database so a stale filesystem
     * status flag can't wrongly skip work after an external DB reset/recreate.
     * Returns true (honor the skip) for steps that have no DB-truth check.
     */
    private function stepStillSatisfiedInDb(string $step): bool
    {
        if ($step === 'seed_initial_data') {
            try {
                // Seeding is "still satisfied" only if vocabulary actually exists in
                // the DB. If the database was reset empty, force a re-seed.
                // Wave A consolidation: the importer seeds vocabulary_libraries
                // rows with word_ids (collections/items are gone), so check that.
                return \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel::query()
                    ->whereNotNull('word_ids')
                    ->exists();
            } catch (\Throwable $e) {
                // Cannot determine -> don't force a surprise re-seed.
                return true;
            }
        }

        if ($step === 'seed_books') {
            // "Still satisfied" only if the shipped corpus is actually present in
            // the DB (completion sentinel). A reset/empty DB forces a re-seed.
            try {
                return \App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1BookSeedImporter::isSeeded();
            } catch (\Throwable $e) {
                return true;
            }
        }

        if ($step === 'seed_ai_prompts') {
            // Re-verify the code-owned prompt rows actually exist (not just that
            // the step ran once) so a reset/empty DB forces a re-seed.
            try {
                return \App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1AiPromptDefaults::isSeeded();
            } catch (\Throwable $e) {
                return true;
            }
        }

        return true;
    }

    private function executeStep(string $step): array
    {
        switch ($step) {
            case 'database_connection':
                return $this->checkDatabaseConnection();
                
            case 'create_database_file':
                return $this->createDatabaseFile();
                
            case 'run_migrations':
                return $this->runMigrations();
                
            case 'verify_tables':
                return $this->verifyTables();
                
            case 'create_indexes':
                return $this->createIndexes();
                
            case 'seed_initial_data':
                return $this->seedInitialData();

            case 'seed_books':
                return $this->seedBooks();

            case 'seed_ai_prompts':
                return $this->seedAiPrompts();

            default:
                return [
                    'status' => 'error',
                    'message' => "Unknown step: {$step}",
                ];
        }
    }
    
    private function checkDatabaseConnection(): array
    {
        try {
            $connectionName = (new AppQyV1MultiLangDictionaryModel)->getConnectionName();
            (new AppQyV1MultiLangDictionaryModel)->getConnection()->getPdo();
            return [
                'status' => 'success',
                'message' => 'Database connection successful',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Database connection failed: ' . $e->getMessage(),
            ];
        }
    }
    
    private function createDatabaseFile(): array
    {
        try {
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

            // Server-managed driver (pgsql): "database" is a DB name, not a file path.
            // touch()/chmod() would create a junk file in the CWD; the database is
            // created by the install/start scripts, so there is nothing to do here.
            $driver = config("database.connections.{$connectionName}.driver");
            if ($driver !== 'sqlite') {
                return [
                    'status' => 'success',
                    'message' => "Server-managed database ({$driver}); no file to create",
                ];
            }

            $dbPath = config("database.connections.{$connectionName}.database");

            if (!$dbPath) {
                return [
                    'status' => 'error',
                    'message' => 'Database path not configured',
                ];
            }

            if (file_exists($dbPath)) {
                return [
                    'status' => 'success',
                    'message' => 'Database file already exists',
                    'path' => $dbPath,
                ];
            }
            
            $dbDir = dirname($dbPath);
            if (!is_dir($dbDir)) {
                mkdir($dbDir, 0755, true);
            }
            
            touch($dbPath);
            chmod($dbPath, 0664);
            
            return [
                'status' => 'success',
                'message' => 'Database file created successfully',
                'path' => $dbPath,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Failed to create database file: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * Check migration status
     * Migrations are handled by sys:init command's runSafeMigrations()
     * This method only checks if tables exist
     */
    private function runMigrations(): array
    {
        try {
            $existingTables = $this->countExistingTables();
            
            if ($existingTables > 0) {
                return [
                    'status' => 'success',
                    'message' => "Tables exist - {$existingTables} dictionary tables found",
                    'note' => 'Migrations are handled by sys:init command',
                ];
            }
            
            return [
                'status' => 'info',
                'message' => 'No dictionary tables found',
                'note' => 'Run php artisan sys:init to create tables via migrations',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Failed to check tables: ' . $e->getMessage(),
            ];
        }
    }
    
    private function countExistingTables(): int
    {
        try {
            $languages = AppQyV1TableMaps::getSupportedLanguages();
            $count = 0;
            
            foreach ($languages as $langCode) {
                $tableName = AppQyV1TableMaps::getDictionaryTableName($langCode);
                $connectionName = (new AppQyV1MultiLangDictionaryModel)->getConnectionName();
                if (Schema::connection($connectionName)->hasTable($tableName)) {
                    $count++;
                }
            }
            
            return $count;
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function verifyTables(): array
    {
        try {
            $connectionName = (new AppQyV1MultiLangDictionaryModel)->getConnectionName();
            $connection = (new AppQyV1MultiLangDictionaryModel)->getConnection();
            $languages = AppQyV1TableMaps::getSupportedLanguages();
            
            $missingTables = [];
            $existingTables = [];
            
            foreach ($languages as $langCode) {
                $tableName = AppQyV1TableMaps::getDictionaryTableName($langCode);

                if (Schema::connection($connectionName)->hasTable($tableName)) {
                    $existingTables[] = $tableName;
                } else {
                    $missingTables[] = $tableName;
                }

                // Books v3.1: per-language authoritative sentence store
                // ({prefix}_sentences_{lang}) must exist for every language.
                $sentenceTable = AppQyV1TableMaps::getSentenceTableName($langCode);
                if (Schema::connection($connectionName)->hasTable($sentenceTable)) {
                    $existingTables[] = $sentenceTable;
                } else {
                    $missingTables[] = $sentenceTable;
                }

                // Books v3.1: per-language chapter store
                // ({prefix}_chapters_{lang}) must exist for every language.
                $chapterTable = AppQyV1TableMaps::getChapterTableName($langCode);
                if (Schema::connection($connectionName)->hasTable($chapterTable)) {
                    $existingTables[] = $chapterTable;
                } else {
                    $missingTables[] = $chapterTable;
                }
            }

            if (!empty($missingTables)) {
                return [
                    'status' => 'warning',
                    'message' => 'Some tables are missing',
                    'existing_count' => count($existingTables),
                    'missing_count' => count($missingTables),
                    'missing_tables' => array_slice($missingTables, 0, 10),
                ];
            }
            
            return [
                'status' => 'success',
                'message' => 'All tables verified',
                'table_count' => count($existingTables),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Table verification failed: ' . $e->getMessage(),
            ];
        }
    }
    
    private function createIndexes(): array
    {
        try {
            return [
                'status' => 'success',
                'message' => 'Indexes created via migration',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Index creation failed: ' . $e->getMessage(),
            ];
        }
    }
    
    private function seedInitialData(): array
    {
        try {
            $vocabularyImporter = new \App\Apps\AppQyV1\Utils\AppQyV1VocabularyImporter();
            $result = $vocabularyImporter->importAllVocabularies('en');

            if ($result['success']) {
                return [
                    'status' => 'success',
                    'message' => sprintf('Imported %d vocabulary collections', $result['imported']),
                    'details' => $result['details'],
                ];
            } else {
                return [
                    'status' => 'warning',
                    'message' => 'Failed to import vocabularies: ' . ($result['error'] ?? 'Unknown error'),
                ];
            }
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Data seeding failed: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * Seed the initial book list from the shipped, compressed corpus
     * (database/seed_data/books). Idempotent + fill-missing; decompresses into a
     * runtime temp dir only (never the code tree). Returns 'warning' (non-fatal,
     * retried next init) if the corpus cannot be decompressed/seeded, so a fresh
     * box without xz/tar still completes initialization.
     */
    private function seedBooks(): array
    {
        try {
            $importer = new \App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1BookSeedImporter();
            return $importer->import();
        } catch (\Exception $e) {
            return [
                'status' => 'warning',
                'message' => 'Book seeding failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Idempotently upsert the code-owned AI prompt library defaults
     * (translate_bilingual_analysis, notebooklm_dialogue). Never touches
     * operator-created (source='database') prompt rows.
     */
    private function seedAiPrompts(): array
    {
        try {
            $result = \App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1AiPromptDefaults::seed();
            return [
                'status' => 'success',
                'message' => sprintf('Seeded %d AI prompt default(s)', $result['seeded']),
                'prompt_keys' => $result['prompt_keys'],
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'warning',
                'message' => 'AI prompt seeding failed: ' . $e->getMessage(),
            ];
        }
    }

    public function checkInitializationStatus(): array
    {
        $status = $this->loadStatus();
        
        return [
            'initialized' => $status['fully_initialized'] ?? false,
            'completed_steps' => $status['completed_steps'] ?? [],
            'last_run' => $status['last_run'] ?? null,
            'app' => $this->getAppName(),
        ];
    }
    
    public function reset(): array
    {
        try {
            if (file_exists($this->statusFile)) {
                unlink($this->statusFile);
            }
            
            return [
                'success' => true,
                'message' => 'Initialization status reset successfully',
                'app' => $this->getAppName(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Failed to reset status: ' . $e->getMessage(),
            ];
        }
    }
    
    private function loadStatus(): array
    {
        if (!file_exists($this->statusFile)) {
            return [
                'fully_initialized' => false,
                'completed_steps' => [],
                'last_run' => null,
            ];
        }
        
        $content = file_get_contents($this->statusFile);
        return json_decode($content, true) ?? [];
    }
    
    private function saveStatus(array $status): void
    {
        file_put_contents(
            $this->statusFile,
            json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }
    
    private function markStepCompleted(string $step): void
    {
        $status = $this->loadStatus();
        $status['completed_steps'][$step] = true;
        $status['last_run'] = now()->toDateTimeString();
        $this->saveStatus($status);
    }
    
    private function markFullyInitialized(): void
    {
        $status = $this->loadStatus();
        $status['fully_initialized'] = true;
        $status['completed_at'] = now()->toDateTimeString();
        $this->saveStatus($status);
    }
    
    public function getDatabaseInfo(): array
    {
        try {
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
            $driver = config("database.connections.{$connectionName}.driver");
            $database = config("database.connections.{$connectionName}.database");
            $sizeBytes = null;

            $info = [
                'connection' => $connectionName,
                'driver' => $driver,
            ];

            // Driver-aware existence/size: on sqlite "database" is a file path; on
            // pgsql it is a server-managed database NAME (file_exists on it always
            // returns false and previously misreported "exists: false / 0 B").
            if ($driver === 'sqlite') {
                $info['path'] = $database;
                if (file_exists($database)) {
                    $info['exists'] = true;
                    $info['size'] = $this->formatBytes(filesize($database));
                } else {
                    $info['exists'] = false;
                    $info['size'] = '0 B';
                }
            } else {
                $info['database'] = $database;
                try {
                    $sizeBytes = DB::connection($connectionName)
                        ->selectOne('SELECT pg_database_size(current_database()) AS size');
                    $info['exists'] = true;
                    $info['size'] = $this->formatBytes((int) ($sizeBytes->size ?? 0));
                } catch (\Exception $e) {
                    $info['exists'] = false;
                    $info['size'] = 'unknown';
                    $info['size_error'] = $e->getMessage();
                }
            }

            if (!empty($info['exists'])) {
                try {
                    $tables = $this->getDatabaseTables();
                    $info['tables'] = $tables;
                } catch (\Exception $e) {
                    $info['tables_error'] = $e->getMessage();
                }
            }

            return $info;
        } catch (\Exception $e) {
            return [
                'error' => $e->getMessage(),
            ];
        }
    }
    
    private function getDatabaseTables(): array
    {
        $connectionName = (new AppQyV1MultiLangDictionaryModel)->getConnectionName();
        $schema = Schema::connection($connectionName);
        $tables = [];
        
        try {
            // Driver-agnostic table enumeration via Laravel's native Schema
            // builder (works identically on sqlite + pgsql). Pass
            // $schemaQualified=false so pgsql returns bare names (not
            // "public.x"); sort for stable output.
            $tableNames = $schema->getTableListing(null, false);
            sort($tableNames);
        } catch (\Exception $e) {
            Log::error("[AppQyV1Init] Failed to get table list: " . $e->getMessage());
            return $tables;
        }

        foreach ($tableNames as $tableName) {
            
            if ($tableName === 'migrations') {
                continue;
            }
            
            try {
                // Use Schema Builder to get column count
                $columns = $schema->getColumnListing($tableName);
                $columnCount = count($columns);
                
                // Use Query Builder for row count
                $model = new AppQyV1MultiLangDictionaryModel();
                $dbConnection = $model->getConnection();
                $rowCount = $dbConnection->table($tableName)->count();
                
                $tables[] = [
                    'name' => $tableName,
                    'columns' => $columnCount,
                    'rows' => $rowCount,
                ];
            } catch (\Exception $e) {
                $tables[] = [
                    'name' => $tableName,
                    'error' => $e->getMessage(),
                ];
            }
        }
        
        return $tables;
    }
    
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
