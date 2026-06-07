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

        $status = $this->loadStatus();
        $results = [];
        $allSuccess = true;
        
        foreach (self::INITIALIZATION_STEPS as $step => $description) {
            if (!$force && isset($status['completed_steps'][$step]) && $status['completed_steps'][$step] === true) {
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
        
        return [
            'success' => $allSuccess,
            'app' => $this->getAppName(),
            'steps' => $results,
            'fully_initialized' => $allSuccess,
            'timestamp' => now()->toDateTimeString(),
        ];
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
            $dbPath = config("database.connections.{$connectionName}.database");
            
            $info = [
                'connection' => $connectionName,
                'driver' => 'sqlite',
                'path' => $dbPath,
            ];
            
            if (file_exists($dbPath)) {
                $info['size'] = $this->formatBytes(filesize($dbPath));
                $info['exists'] = true;
                
                try {
                    $tables = $this->getDatabaseTables();
                    $info['tables'] = $tables;
                } catch (\Exception $e) {
                    $info['tables_error'] = $e->getMessage();
                }
            } else {
                $info['exists'] = false;
                $info['size'] = '0 B';
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
        $connection = (new AppQyV1MultiLangDictionaryModel)->getConnection();
        $schema = Schema::connection($connectionName);
        $tables = [];
        
        try {
            $tableNames = $connection->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        } catch (\Exception $e) {
            Log::error("[AppQyV1Init] Failed to get table list: " . $e->getMessage());
            return $tables;
        }
        
        foreach ($tableNames as $tableObj) {
            $tableName = $tableObj->name;
            
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
