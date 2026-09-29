<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Apps\McpV1\McpV1Models\McpV1PlaceholderImageModel;
use App\Contracts\AppInitializerInterface;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class McpV1Initializer implements AppInitializerInterface
{
    private const LANG_PREFIX = 'mcp_v1.init.';

    private $statusFile;

    const INITIALIZATION_STEPS = [
        'database_connection' => 'Check database connection',
        'create_placeholder_table' => 'Create placeholder_images table',
        'verify_tables' => 'Verify all MCP tables created',
        'create_storage_directory' => 'Create MCP storage directories',
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

        $appKey = AppKeys::MCPV1;
        $tablePrefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }

    public function getAppName(): string
    {
        return 'McpV1';
    }

    public function initialize(bool $force = false): array
    {
        $status = $this->loadStatus();
        $results = [];
        $allSuccess = true;

        foreach (self::INITIALIZATION_STEPS as $step => $description) {
            if (
                !$force
                && isset($status['completed_steps'][$step])
                && $status['completed_steps'][$step] === true
                && $this->stepStateHolds($step)
            ) {
                $results[$step] = [
                    'status' => 'skipped',
                    'message' => 'Already completed',
                    'description' => $description,
                ];
                continue;
            }

            Log::info("[McpV1Init] Running step: {$step} - {$description}");
            if (PHP_SAPI === 'cli') {
                echo "    [McpV1] Step {$step}: {$description}...\n";
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
        if (file_exists($this->statusFile)) {
            unlink($this->statusFile);
        }

        return [
            'success' => true,
            'message' => 'McpV1 initialization status reset successfully',
        ];
    }

    private function executeStep(string $step): array
    {
        switch ($step) {
            case 'database_connection':
                return $this->checkDatabaseConnection();

            case 'create_placeholder_table':
                return $this->createPlaceholderTable();

            case 'verify_tables':
                return $this->verifyTables();

            case 'create_storage_directory':
                return $this->createStorageDirectory();

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
            $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::MCPV1);
            DB::connection($connectionName)->getPdo();

            return [
                'status' => 'success',
                'message' => 'Database connection established',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Database connection failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Whether the real state a completed step produced still holds, so the
     * status file alone never skips a step whose schema or directory is gone.
     */
    private function stepStateHolds(string $step): bool
    {
        try {
            return match ($step) {
                'create_placeholder_table', 'verify_tables' => McpV1PlaceholderImageModel::schemaReady(),
                'create_storage_directory' => is_dir(McpV1PlaceholderUtil::storageDirectory()),
                default => true,
            };
        } catch (\Throwable $e) {
            Log::warning('[McpV1Init] Step state check failed; re-running the step', [
                'step' => $step,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Idempotent add-only ensure of placeholder_images from the model's
     * structure: creates a missing table and adds missing columns/indexes,
     * whatever the migrations repository records.
     */
    private function createPlaceholderTable(): array
    {
        try {
            $alignment = McpV1PlaceholderImageModel::ensureTableAligned(McpV1PlaceholderImageModel::tableStructure());
            $tableStatus = $alignment['status'] ?? 'error';

            if (!McpV1PlaceholderImageModel::schemaReady()) {
                return [
                    'status' => 'error',
                    'message' => __(self::LANG_PREFIX . 'placeholder_table_missing', [
                        'connection' => AppTablePrefixServiceProvider::getConnection(AppKeys::MCPV1),
                    ]),
                    'table_status' => $tableStatus,
                ];
            }

            return [
                'status' => 'success',
                'message' => match ($tableStatus) {
                    'created' => 'Table placeholder_images created successfully',
                    'updated' => __(self::LANG_PREFIX . 'placeholder_table_aligned', ['count' => count($alignment['actions'] ?? [])]),
                    default => 'Table placeholder_images already exists',
                },
                'table_status' => $tableStatus,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Failed to create placeholder_images table: ' . $e->getMessage(),
            ];
        }
    }

    private function verifyTables(): array
    {
        try {
            if (McpV1PlaceholderImageModel::schemaReady()) {
                return [
                    'status' => 'success',
                    'message' => 'All required MCP tables exist',
                ];
            }

            return [
                'status' => 'error',
                'message' => __(self::LANG_PREFIX . 'placeholder_table_missing', [
                    'connection' => AppTablePrefixServiceProvider::getConnection(AppKeys::MCPV1),
                ]),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Failed to verify tables: ' . $e->getMessage(),
            ];
        }
    }

    private function createStorageDirectory(): array
    {
        try {
            $storageDir = McpV1PlaceholderUtil::storageDirectory();

            if (!file_exists($storageDir)) {
                mkdir($storageDir, 0755, true);
                $message = "Created storage directory: {$storageDir}";
            } else {
                $message = "Storage directory already exists: {$storageDir}";
            }

            return [
                'status' => 'success',
                'message' => $message,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => 'Failed to create storage directory: ' . $e->getMessage(),
            ];
        }
    }

    private function loadStatus(): array
    {
        if (file_exists($this->statusFile)) {
            $json = file_get_contents($this->statusFile);
            return json_decode($json, true) ?? [];
        }

        return [];
    }

    private function saveStatus(array $status): void
    {
        $status['last_run'] = now()->toDateTimeString();
        file_put_contents($this->statusFile, json_encode($status, JSON_PRETTY_PRINT));
    }

    private function markStepCompleted(string $step): void
    {
        $status = $this->loadStatus();

        if (!isset($status['completed_steps'])) {
            $status['completed_steps'] = [];
        }

        $status['completed_steps'][$step] = true;
        $this->saveStatus($status);
    }

    private function markFullyInitialized(): void
    {
        $status = $this->loadStatus();
        $status['fully_initialized'] = true;
        $this->saveStatus($status);
    }
}
