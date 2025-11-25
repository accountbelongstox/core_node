<?php

namespace App\Apps\AppQyV1\Utils;

use App\Contracts\AppInitializerInterface;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
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
            throw new \Exception('Laravel database directory not found');
        }
        
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }
        
        $this->statusFile = $dbDir . '/app_qy_v1_init_status.json';
    }
    
    public function getAppName(): string
    {
        return 'AppQyV1';
    }
    
    public function initialize(bool $force = false): array
    {
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
            
            try {
                $result = $this->executeStep($step);
                $results[$step] = array_merge($result, ['description' => $description]);
                
                if ($result['status'] === 'success') {
                    $this->markStepCompleted($step);
                } else {
                    $allSuccess = false;
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
                
                if (!$force) {
                    break;
                }
            }
        }
        
        if ($allSuccess) {
            $this->markFullyInitialized();
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
            DB::connection('AppQyV1')->getPdo();
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
            $dbPath = config('database.connections.AppQyV1.database');
            
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
    
    private function runMigrations(): array
    {
        try {
            $migrationPath = 'database/migrations/AppQyV1_2025_11_23_231133_create_multi_language_dictionaries_tables.php';
            
            if (!file_exists(base_path($migrationPath))) {
                return [
                    'status' => 'error',
                    'message' => 'Migration file not found: ' . $migrationPath,
                ];
            }
            
            $existingTables = $this->countExistingTables();
            
            if ($existingTables > 0) {
                return [
                    'status' => 'success',
                    'message' => "Migration skipped - {$existingTables} tables already exist",
                    'note' => 'Tables were created in a previous run',
                ];
            }
            
            Artisan::call('migrate', [
                '--database' => 'AppQyV1',
                '--path' => $migrationPath,
                '--force' => true,
            ]);
            
            $output = Artisan::output();
            
            return [
                'status' => 'success',
                'message' => 'Migrations executed successfully',
                'output' => trim($output),
            ];
        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();
            
            if (strpos($errorMsg, 'already exists') !== false) {
                $existingTables = $this->countExistingTables();
                return [
                    'status' => 'success',
                    'message' => "Migration completed with warnings - {$existingTables} tables exist",
                    'note' => 'Some tables already existed',
                ];
            }
            
            return [
                'status' => 'error',
                'message' => 'Migration failed: ' . $errorMsg,
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
                if (Schema::connection('AppQyV1')->hasTable($tableName)) {
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
            $connection = DB::connection('AppQyV1');
            $languages = AppQyV1TableMaps::getSupportedLanguages();
            
            $missingTables = [];
            $existingTables = [];
            
            foreach ($languages as $langCode) {
                $tableName = AppQyV1TableMaps::getDictionaryTableName($langCode);
                
                if (Schema::connection('AppQyV1')->hasTable($tableName)) {
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
            $dbPath = config('database.connections.AppQyV1.database');
            
            $info = [
                'connection' => 'AppQyV1',
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
        $connection = DB::connection('AppQyV1');
        $tables = [];
        
        $tableNames = $connection->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        
        foreach ($tableNames as $tableObj) {
            $tableName = $tableObj->name;
            
            if ($tableName === 'migrations') {
                continue;
            }
            
            try {
                $columns = $connection->select("PRAGMA table_info({$tableName})");
                $columnCount = count($columns);
                
                $rowCount = $connection->selectOne("SELECT COUNT(*) as count FROM {$tableName}")->count;
                
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
