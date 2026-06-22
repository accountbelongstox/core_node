<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\Utils;

use App\Contracts\AppInitializerInterface;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1TablesInitializer;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PackageModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;
use App\Apps\PddToolV1\PddToolV1Constants\PddToolV1Defaults;
use App\Models\User;
use App\Http\Common\CommonUserGen;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

/**
 * PddToolV1 (订多多) sys:init initializer. Status-file scaffolding mirrors
 * AppQyV1Initializer. Steps:
 *   verify_tables  - confirm the migration created all tables
 *   seed_packages  - upsert the four tiers (TRIAL/PRO/PRO_PLUS/ULTIMATE)
 *   seed_admin     - create the default admin member if absent
 *
 * Registered in App\Console\Commands\InitializeApps::handle().
 */
class PddToolV1Initializer implements AppInitializerInterface
{
    private $statusFile;

    const INITIALIZATION_STEPS = [
        'verify_tables' => 'Verify all tables created',
        'seed_packages' => 'Seed membership packages (TRIAL/PRO/PRO_PLUS/ULTIMATE)',
        'seed_admin' => 'Seed default admin member',
    ];

    public function __construct()
    {
        $dbDir = \App\Providers\PathMapper::getLaravelDatabaseDir();
        if (!$dbDir) {
            Log::error('[PddToolV1Initializer] Laravel database directory not found');
            return;
        }

        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }

        $appKey = AppKeys::PDDTOOLV1;
        $tablePrefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }

    public function getAppName(): string
    {
        return 'PddToolV1';
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

            Log::info("[PddToolV1Init] Running step: {$step} - {$description}");
            if (PHP_SAPI === 'cli') {
                echo "    [PddToolV1] Step {$step}: {$description}...\n";
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
                return PddToolV1TablesInitializer::allTablesExist();
            }
            if ($step === 'seed_packages') {
                return PddToolV1PackageModel::query()->count() > 0;
            }
            if ($step === 'seed_admin') {
                $admin = User::query()->where('username', PddToolV1Defaults::DEFAULT_ADMIN_USERNAME)->first();
                if (!$admin) {
                    return false;
                }
                return PddToolV1ProfileModel::query()->where('user_id', $admin->id)->exists();
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
            case 'seed_packages':
                return $this->seedPackages();
            case 'seed_admin':
                return $this->seedAdmin();
            default:
                return ['status' => 'error', 'message' => "Unknown step: {$step}"];
        }
    }

    private function verifyTables(): array
    {
        $checks = PddToolV1TablesInitializer::checkTables();
        $missing = array_keys(array_filter($checks, fn ($s) => $s !== 'exists'));

        if (!empty($missing)) {
            return [
                'status' => 'warning',
                'message' => 'Some tables are missing: ' . implode(', ', $missing),
                'missing_tables' => $missing,
            ];
        }

        return [
            'status' => 'success',
            'message' => 'All ' . count($checks) . ' tables verified',
        ];
    }

    /**
     * Upsert the four canonical tiers (idempotent; never clobbers a price that an
     * admin later changed beyond re-aligning the seed defaults on a fresh code base).
     */
    private function seedPackages(): array
    {
        try {
            $created = 0;
            $existing = 0;

            foreach (PddToolV1Defaults::PACKAGES as $code => $def) {
                $row = PddToolV1PackageModel::query()->where('code', $code)->first();
                if ($row) {
                    $existing++;
                    continue;
                }
                PddToolV1PackageModel::query()->create($def);
                $created++;
            }

            return [
                'status' => 'success',
                'message' => "Packages seeded ({$created} created, {$existing} existing)",
            ];
        } catch (\Exception $e) {
            return ['status' => 'error', 'message' => 'Package seeding failed: ' . $e->getMessage()];
        }
    }

    /**
     * Create the default admin as a global User + ULTIMATE PddToolV1 profile
     * (idempotent). Identity (username/password) lives in the global users table;
     * membership lives in the per-app profile keyed by user_id.
     */
    private function seedAdmin(): array
    {
        try {
            $admin = User::query()->where('username', PddToolV1Defaults::DEFAULT_ADMIN_USERNAME)->first();

            if (!$admin) {
                // Create the canonical global user via the unified path (hashed
                // password, auto nickname/avatar). Fall back to a direct User::create
                // if the unified path fails for any reason.
                $created = CommonUserGen::createUser(
                    PddToolV1Defaults::DEFAULT_ADMIN_USERNAME,
                    PddToolV1Defaults::DEFAULT_ADMIN_PASSWORD
                );
                if ($created && !empty($created['user'])) {
                    $admin = $created['user'];
                } else {
                    $admin = User::create([
                        'username' => PddToolV1Defaults::DEFAULT_ADMIN_USERNAME,
                        'password' => Hash::make(PddToolV1Defaults::DEFAULT_ADMIN_PASSWORD),
                    ]);
                }
            }

            // ULTIMATE, non-expiring profile for the admin.
            PddToolV1ProfileModel::ensureUltimate((int) $admin->id);

            return ['status' => 'success', 'message' => 'Default admin created'];
        } catch (\Exception $e) {
            return ['status' => 'error', 'message' => 'Admin seeding failed: ' . $e->getMessage()];
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
