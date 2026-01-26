<?php

namespace App\Apps\BankV1\BankV1Utils;

use App\Contracts\AppInitializerInterface;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\Model;

class BankV1Initializer implements AppInitializerInterface
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

        $appKey = AppKeys::BANKV1;
        $tablePrefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }

    public function getAppName(): string
    {
        return 'BankV1';
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

            Log::info("[BankV1Init] Running step: {$step} - {$description}");

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
            $appKey = AppKeys::BANKV1;
            $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
            $model = new class extends Model {};
            $model->setConnection($connectionName);
            $model->getConnection()->getPdo();
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
            $appKey = AppKeys::BANKV1;
            $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
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

    private function runMigrations(): array
    {
        try {
            $existingTables = $this->countExistingTables();

            if ($existingTables > 0) {
                return [
                    'status' => 'success',
                    'message' => "Tables exist - {$existingTables} tables found",
                    'note' => 'Migrations are handled by sys:init command',
                ];
            }

            return [
                'status' => 'info',
                'message' => 'No tables found',
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
            $appKey = AppKeys::BANKV1;
            $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
            $tableMaps = new BankV1TablesMaps();
            $tables = $tableMaps->getTables();
            $count = 0;

            foreach ($tables as $tableKey => $tableInfo) {
                $tableName = $tableInfo['tablename'];
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
            $appKey = AppKeys::BANKV1;
            $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
            $tableMaps = new BankV1TablesMaps();
            $tables = $tableMaps->getTables();

            $missingTables = [];
            $existingTables = [];

            foreach ($tables as $tableKey => $tableInfo) {
                $tableName = $tableInfo['tablename'];

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
            return [
                'status' => 'success',
                'message' => 'No initial data seeding required',
            ];
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
            $appKey = AppKeys::BANKV1;
            $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
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
        $appKey = AppKeys::BANKV1;
        $connectionName = AppTablePrefixServiceProvider::getConnection($appKey);
        $model = new class extends Model {};
        $model->setConnection($connectionName);
        $connection = $model->getConnection();
        $schema = Schema::connection($connectionName);
        $tables = [];

        try {
            $tableNames = $connection->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        } catch (\Exception $e) {
            Log::error("[BankV1Init] Failed to get table list: " . $e->getMessage());
            return $tables;
        }

        foreach ($tableNames as $tableObj) {
            $tableName = $tableObj->name;

            if ($tableName === 'migrations') {
                continue;
            }

            try {
                $columns = $schema->getColumnListing($tableName);
                $columnCount = count($columns);

                $rowCount = $connection->table($tableName)->count();

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

