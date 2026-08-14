<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\Utils;

use App\Contracts\AppInitializerInterface;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1DBTablesBrige\DingDuoDuoV1TableMaps;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1RechargeConfigModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1SuperCodeModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1SuperCodeService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

/**
 * DingDuoDuoV1 (订多多) sys:init initializer. Status-file scaffolding mirrors
 * PddToolV1Initializer / AppQyV1Initializer. Steps:
 *   verify_tables        - confirm the migrations created all six tables
 *   seed_recharge_config - create one enabled 'custom' recharge config if absent
 *   seed_master_codes    - upsert the three offline MASTER_CODES into super_codes
 *
 * Registered in App\Console\Commands\InitializeApps::handle().
 */
class DingDuoDuoV1Initializer implements AppInitializerInterface
{
    private $statusFile;

    const INITIALIZATION_STEPS = [
        'verify_tables' => 'Verify all tables created',
        'seed_recharge_config' => 'Seed default recharge config (custom provider)',
        'seed_master_codes' => 'Seed offline master super codes',
    ];

    const TABLE_KEYS = [
        'MEMBERS',
        'SUPER_CODES',
        'DEVICES',
        'PDD_BINDINGS',
        'RECHARGE_CONFIGS',
        'RECHARGE_ORDERS',
    ];

    public function __construct()
    {
        $dbDir = \App\Providers\PathMapper::getLaravelDatabaseDir();
        if (!$dbDir) {
            Log::error('[DingDuoDuoV1Initializer] Laravel database directory not found');
            return;
        }

        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }

        $appKey = AppKeys::DINGDUODUOV1;
        $tablePrefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }

    public function getAppName(): string
    {
        return 'DingDuoDuoV1';
    }

    public function initialize(bool $force = false): array
    {
        $status = $this->loadStatus();
        $results = [];
        $allSuccess = true;

        foreach (self::INITIALIZATION_STEPS as $step => $description) {
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

            Log::info("[DingDuoDuoV1Init] Running step: {$step} - {$description}");
            if (PHP_SAPI === 'cli') {
                echo "    [DingDuoDuoV1] Step {$step}: {$description}...\n";
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

    /**
     * Re-verify data-bearing steps against the live DB so a stale status flag can't
     * wrongly skip work after an external reset.
     */
    private function stepStillSatisfiedInDb(string $step): bool
    {
        try {
            if ($step === 'verify_tables') {
                return $this->allTablesExist();
            }
            if ($step === 'seed_recharge_config') {
                return DingDuoDuoV1RechargeConfigModel::anyExists();
            }
            if ($step === 'seed_master_codes') {
                return DingDuoDuoV1SuperCodeModel::countMatchingCodes(
                    DingDuoDuoV1SuperCodeService::MASTER_CODES
                ) === count(DingDuoDuoV1SuperCodeService::MASTER_CODES);
            }
        } catch (\Throwable $e) {
            return true;
        }

        return true;
    }

    private function executeStep(string $step): array
    {
        switch ($step) {
            case 'verify_tables':
                return $this->verifyTables();
            case 'seed_recharge_config':
                return $this->seedRechargeConfig();
            case 'seed_master_codes':
                return $this->seedMasterCodes();
            default:
                return ['status' => 'error', 'message' => "Unknown step: {$step}"];
        }
    }

    private function verifyTables(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::DINGDUODUOV1);
        $missing = [];

        foreach (self::TABLE_KEYS as $key) {
            $tableName = DingDuoDuoV1TableMaps::getTableName($key);
            if (!Schema::connection($connection)->hasTable($tableName)) {
                $missing[] = $tableName;
            }
        }

        if (!empty($missing)) {
            return [
                'status' => 'warning',
                'message' => 'Some tables are missing: ' . implode(', ', $missing),
                'missing_tables' => $missing,
            ];
        }

        return [
            'status' => 'success',
            'message' => 'All ' . count(self::TABLE_KEYS) . ' tables verified',
        ];
    }

    /**
     * Seed one enabled 'custom' recharge config with the default package list when
     * none exists (idempotent).
     */
    private function seedRechargeConfig(): array
    {
        try {
            if (DingDuoDuoV1RechargeConfigModel::anyExists()) {
                return ['status' => 'success', 'message' => 'Recharge config already present'];
            }

            DingDuoDuoV1RechargeConfigModel::createRecord([
                'provider' => DingDuoDuoV1Constants::DEFAULT_PROVIDER,
                'enabled' => true,
                'packages' => DingDuoDuoV1Constants::DEFAULT_PACKAGES,
            ]);

            return ['status' => 'success', 'message' => 'Default recharge config seeded'];
        } catch (\Exception $e) {
            return ['status' => 'error', 'message' => 'Recharge config seeding failed: ' . $e->getMessage()];
        }
    }

    /**
     * Upsert the offline MASTER_CODES into super_codes by code (idempotent), each as
     * an unlimited / unrestricted super code (max_binds 0, features ['*']).
     */
    private function seedMasterCodes(): array
    {
        try {
            $created = 0;
            $existing = 0;

            foreach (DingDuoDuoV1SuperCodeService::MASTER_CODES as $code) {
                $row = DingDuoDuoV1SuperCodeModel::findByCode($code);
                if ($row) {
                    $existing++;
                    continue;
                }

                DingDuoDuoV1SuperCodeModel::createRecord([
                    'code' => $code,
                    'label' => 'Master Code',
                    'tier' => DingDuoDuoV1Constants::TIER_UNLIMITED,
                    'max_binds' => 0,
                    'features' => ['*'],
                    'scope' => null,
                    'expires_at' => null,
                    'status' => DingDuoDuoV1SuperCodeModel::STATUS_ACTIVE,
                    'created_by' => 'system',
                ]);
                $created++;
            }

            return [
                'status' => 'success',
                'message' => "Master codes seeded ({$created} created, {$existing} existing)",
            ];
        } catch (\Exception $e) {
            return ['status' => 'error', 'message' => 'Master code seeding failed: ' . $e->getMessage()];
        }
    }

    private function allTablesExist(): bool
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::DINGDUODUOV1);

        foreach (self::TABLE_KEYS as $key) {
            $tableName = DingDuoDuoV1TableMaps::getTableName($key);
            if (!Schema::connection($connection)->hasTable($tableName)) {
                return false;
            }
        }

        return true;
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
            if ($this->statusFile && file_exists($this->statusFile)) {
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
        if (!$this->statusFile || !file_exists($this->statusFile)) {
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
        if (!$this->statusFile) {
            return;
        }
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
}
