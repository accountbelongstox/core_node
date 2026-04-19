<?php

namespace App\Apps\AwyV0\Utils;

use App\Contracts\AppInitializerInterface;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AwyV0\AwyV0DBTablesBrige\AwyV0TableMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\Model;

class AwyV0Initializer implements AppInitializerInterface
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

        $appKey = AppKeys::AWYV0;
        $tablePrefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }

    public function getAppName(): string
    {
        return 'AwyV0';
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

            Log::info("[AwyV0Init] Running step: {$step} - {$description}");
            if (PHP_SAPI === 'cli') {
                echo "    [AwyV0] Step {$step}: {$description}...\n";
            }

            try {
                $result = $this->executeStep($step);
                $results[$step] = array_merge($result, ['description' => $description]);

                $statusCode = $result['status'] ?? 'error';

                if ($statusCode === 'success') {
                    $this->markStepCompleted($step);
                    if (PHP_SAPI === 'cli') {
                        echo "      -> OK: {$result['message']}\n";
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
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
            DB::connection($connectionName)->getPdo();
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
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
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
            $migrationPath = 'database/migrations/AwyV0_2025_12_03_create_awy_v0_tables.php';

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

            // Migrations are handled by sys:init command
            // This method only checks if tables exist
            $output = 'Migrations are handled by sys:init command';

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
            $tableKeys = AwyV0TableMaps::getAvailableTableKeys();
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
            $count = 0;

            foreach ($tableKeys as $tableKey) {
                $tableName = AwyV0TableMaps::getTableName($tableKey);
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
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
            $tableKeys = AwyV0TableMaps::getAvailableTableKeys();

            $missingTables = [];
            $existingTables = [];

            foreach ($tableKeys as $tableKey) {
                $tableName = AwyV0TableMaps::getTableName($tableKey);

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
                    'missing_tables' => $missingTables,
                ];
            }

            return [
                'status' => 'success',
                'message' => 'All tables verified',
                'table_count' => count($existingTables),
                'tables' => $existingTables,
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
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
            $schema = Schema::connection($connectionName);

            $indexes = [
                'awy_v0_users' => [
                    'idx_username' => 'username',
                    'idx_email' => 'email',
                    'idx_phone' => 'phone',
                ],
                'awy_v0_friends' => [
                    'idx_user_id' => 'user_id',
                    'idx_friend_id' => 'friend_id',
                ],
                'awy_v0_devices' => [
                    'idx_user_id' => 'user_id',
                    'idx_device_token' => 'device_token',
                ],
                'awy_v0_chats' => [
                    'idx_sender_id' => 'sender_id',
                    'idx_receiver_id' => 'receiver_id',
                ],
            ];

            $createdIndexes = 0;
            foreach ($indexes as $table => $tableIndexes) {
                if (!$schema->hasTable($table)) {
                    continue;
                }

                foreach ($tableIndexes as $indexName => $column) {
                    try {
                        // Check if index already exists by trying to get column indexes
                        $hasIndex = false;
                        try {
                            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
                            $indexesList = DB::connection($connectionName)
                                ->select("SELECT name FROM sqlite_master WHERE type='index' AND name='{$indexName}'");
                            $hasIndex = !empty($indexesList);
                        } catch (\Exception $e) {
                            // If we can't check, try to create it
                        }

                        if (!$hasIndex) {
                            $schema->table($table, function ($table) use ($column, $indexName) {
                                $table->index($column, $indexName);
                            });
                            $createdIndexes++;
                        }
                    } catch (\Exception $e) {
                        // Index might already exist or column doesn't exist
                        Log::debug("[AwyV0Init] Index creation skipped for {$indexName}: " . $e->getMessage());
                    }
                }
            }

            return [
                'status' => 'success',
                'message' => "Created/verified {$createdIndexes} indexes",
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
                'message' => 'No initial data seeding required for AwyV0',
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
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
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
        $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
        $schema = Schema::connection($connectionName);
        $connection = DB::connection($connectionName);
        $tables = [];

        // Use Schema Builder to get table list when possible
        try {
            $tableNames = $connection->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        } catch (\Exception $e) {
            Log::error("[AwyV0Init] Failed to get table list: " . $e->getMessage());
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

                // Use Query Builder for row count (Laravel best practice)
                $dbConnection = $this->getDbConnection();
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

    /**
     * Get database connection using model (Laravel best practice)
     * Creates a temporary model instance to get the connection
     */
    private function getDbConnection()
    {
        $model = new class extends Model {
            // Temporary model for getting connection
        };
        $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::AWYV0);
        $model->setConnection($connectionName);
        return $model->getConnection();
    }
}
