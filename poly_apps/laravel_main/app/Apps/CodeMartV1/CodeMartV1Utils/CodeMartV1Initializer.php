<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Constants\AppKeys;
use App\Contracts\AppInitializerInterface;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Providers\AppTablePrefixServiceProvider;
use App\Providers\PathMapper;
use App\Services\SafeMigrationHelper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * CodeMartV1 sys:init initializer. Idempotent and additive only: every step
 * runs through SafeMigrationHelper::alignTableStructureFromArray(), which
 * creates missing tables/columns/indexes in place and never drops, truncates,
 * or rebuilds existing data. Registered in AppInitializationManager.
 */
class CodeMartV1Initializer implements AppInitializerInterface
{
    private ?string $statusFile = null;

    private const INITIALIZATION_STEPS = [
        'align_contract_tables' => 'Align additive contract tables and columns',
        'align_status_constraints' => 'Align check constraints with the contract status sets',
        'verify_tables' => 'Verify all CodeMart tables exist',
        'seed_demo_data' => 'Seed CodeMart demo dataset',
    ];

    private const REQUIRED_TABLES = [
        'codemart_v1_email_verifications',
        'codemart_v1_phone_verifications',
        'codemart_v1_kyc_verifications',
        'codemart_v1_user_roles',
        'codemart_v1_developer_profiles',
        'codemart_v1_client_profiles',
        'codemart_v1_projects',
        'codemart_v1_milestones',
        'codemart_v1_project_proposals',
        'codemart_v1_project_attachments',
        'codemart_v1_tasks',
        'codemart_v1_task_submissions',
        'codemart_v1_task_comments',
        'codemart_v1_code_reviews',
        'codemart_v1_wallets',
        'codemart_v1_wallet_transactions',
        'codemart_v1_payments',
        'codemart_v1_escrows',
        'codemart_v1_invoices',
        'codemart_v1_refunds',
        'codemart_v1_deposits',
        'codemart_v1_ai_analyses',
        'codemart_v1_developer_stats',
        'codemart_v1_reviewer_applications',
        'codemart_v1_reviewer_code_reviews',
        'codemart_v1_notifications',
        'codemart_v1_activities',
        'codemart_v1_testimonials',
        'codemart_v1_contact_messages',
        'codemart_v1_withdrawals',
    ];

    public function __construct()
    {
        $dbDir = PathMapper::getLaravelDatabaseDir();
        if (!$dbDir) {
            Log::error('[CodeMartV1Initializer] Laravel database directory not found');
            return;
        }

        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }

        $tablePrefix = AppTablePrefixServiceProvider::getPrefix(AppKeys::CODEMARTV1);
        $this->statusFile = $dbDir . '/' . $tablePrefix . '_init_status.json';
    }

    public function getAppName(): string
    {
        return 'CodeMartV1';
    }

    public function initialize(bool $force = false): array
    {
        $results = [];
        $allSuccess = true;

        foreach (self::INITIALIZATION_STEPS as $step => $description) {
            Log::info("[CodeMartV1Init] Running step: {$step} - {$description}");

            try {
                $result = $this->executeStep($step);
                $results[$step] = array_merge($result, ['description' => $description]);

                if (($result['status'] ?? 'error') === 'error') {
                    $allSuccess = false;
                    if (!$force) {
                        break;
                    }
                }
            } catch (\Throwable $e) {
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
        return match ($step) {
            'align_contract_tables' => $this->alignContractTables(),
            'align_status_constraints' => $this->alignStatusConstraints(),
            'verify_tables' => $this->verifyTables(),
            'seed_demo_data' => $this->seedDemoData(),
            default => ['status' => 'error', 'message' => "Unknown step: {$step}"],
        };
    }

    /**
     * Additive alignment: new contract tables plus the new columns required by
     * the accepted design (idempotency keys, state revisions, execution
     * references, assignment timestamps). Existing columns and rows are kept.
     */
    private function alignContractTables(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::CODEMARTV1);
        $aligned = [];
        $errors = [];

        foreach (self::contractTableStructures() as $tableName => $structure) {
            try {
                $result = SafeMigrationHelper::alignTableStructureFromArray(
                    $connection,
                    $tableName,
                    $structure,
                    [
                        'shrink_columns' => false,
                        'modify_columns' => true,
                        'add_indexes' => true,
                    ]
                );
                $aligned[$tableName] = is_array($result) ? ($result['status'] ?? 'ok') : 'ok';
            } catch (\Throwable $e) {
                $errors[] = "{$tableName}: {$e->getMessage()}";
            }
        }

        if ($errors !== []) {
            return ['status' => 'error', 'message' => implode('; ', $errors)];
        }

        return [
            'status' => 'success',
            'message' => 'Aligned ' . count($aligned) . ' contract tables/columns',
            'tables' => $aligned,
        ];
    }

    /**
     * Constraint alignment (table modification only, never drop/rebuild):
     * recreates a check constraint when the live definition no longer covers
     * every value the contract constants allow. Declared per (table, column);
     * idempotent — a constraint that already covers all values is untouched.
     */
    private function alignStatusConstraints(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::CODEMARTV1);
        $tasksTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::CODEMARTV1, 'tasks');
        $projectsTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::CODEMARTV1, 'projects');
        $submissionsTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::CODEMARTV1, 'task_submissions');
        $paymentsTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::CODEMARTV1, 'payments');
        $depositsTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::CODEMARTV1, 'deposits');

        $constraintSpecs = [
            ['table' => $projectsTable, 'column' => 'status', 'values' => CodeMartV1Constants::getAllProjectStatuses()],
            ['table' => $depositsTable, 'column' => 'status', 'values' => CodeMartV1Constants::getAllDepositStatuses()],
            ['table' => $tasksTable, 'column' => 'status', 'values' => CodeMartV1Constants::getAllTaskStatuses()],
            ['table' => $submissionsTable, 'column' => 'status', 'values' => [
                CodeMartV1Constants::SUBMISSION_STATUS_PENDING,
                CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
                CodeMartV1Constants::SUBMISSION_STATUS_APPROVED,
                CodeMartV1Constants::SUBMISSION_STATUS_NEEDS_REVISION,
                CodeMartV1Constants::SUBMISSION_STATUS_REJECTED,
            ]],
            ['table' => $paymentsTable, 'column' => 'status', 'values' => [
                CodeMartV1Constants::PAYMENT_STATUS_PENDING,
                CodeMartV1Constants::PAYMENT_STATUS_PROCESSING,
                CodeMartV1Constants::PAYMENT_STATUS_COMPLETED,
                CodeMartV1Constants::PAYMENT_STATUS_FAILED,
                CodeMartV1Constants::PAYMENT_STATUS_CANCELLED,
                CodeMartV1Constants::PAYMENT_STATUS_DISPUTED,
                CodeMartV1Constants::PAYMENT_STATUS_REFUNDED,
            ]],
        ];

        $aligned = [];
        $errors = [];

        foreach ($constraintSpecs as $spec) {
            try {
                $this->alignCheckConstraint($connection, $spec['table'], $spec['column'], $spec['values']);
                $aligned[] = $spec['table'] . '.' . $spec['column'];
            } catch (\Throwable $e) {
                $errors[] = $spec['table'] . '.' . $spec['column'] . ': ' . $e->getMessage();
            }
        }

        if ($errors !== []) {
            return ['status' => 'error', 'message' => implode('; ', $errors)];
        }

        return [
            'status' => 'success',
            'message' => 'Aligned ' . count($aligned) . ' check constraints',
            'constraints' => $aligned,
        ];
    }

    private function alignCheckConstraint(string $connection, string $tableName, string $column, array $values): void
    {
        $constraintName = $tableName . '_' . $column . '_check';
        $quotedValues = implode(', ', array_map(
            static fn (string $value): string => "'" . str_replace("'", "''", $value) . "'",
            $values
        ));

        $current = DB::connection($connection)->selectOne(
            'SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = ? AND conrelid = ?::regclass',
            [$constraintName, $tableName]
        );

        $currentDef = $current->def ?? null;

        if (is_string($currentDef)) {
            $coversAll = true;
            foreach ($values as $value) {
                if (strpos($currentDef, "'" . $value . "'") === false) {
                    $coversAll = false;
                    break;
                }
            }
            if ($coversAll) {
                return;
            }
        }

        DB::connection($connection)->statement(
            "ALTER TABLE {$tableName} DROP CONSTRAINT IF EXISTS {$constraintName}"
        );
        DB::connection($connection)->statement(
            "ALTER TABLE {$tableName} ADD CONSTRAINT {$constraintName} CHECK ({$column}::text = ANY (ARRAY[{$quotedValues}]::text[]))"
        );
    }

    /**
     * Declarative additive structures. Only new tables and new columns are
     * listed; alignTableStructureFromArray leaves every existing column alone.
     */
    public static function contractTableStructures(): array
    {
        return [
            'codemart_v1_notifications' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'user_id' => ['type' => 'bigInteger', 'nullable' => false],
                    'type' => ['type' => 'string', 'nullable' => false],
                    'title_key' => ['type' => 'string', 'nullable' => false],
                    'body_key' => ['type' => 'string', 'nullable' => true],
                    'params' => ['type' => 'json', 'nullable' => true],
                    'resource_type' => ['type' => 'string', 'nullable' => true],
                    'resource_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'read_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['user_id', 'read_at']],
                    ['columns' => ['user_id']],
                ],
            ],
            'codemart_v1_activities' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'actor_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'resource_type' => ['type' => 'string', 'nullable' => false],
                    'resource_id' => ['type' => 'bigInteger', 'nullable' => false],
                    'action' => ['type' => 'string', 'nullable' => false],
                    'from_state' => ['type' => 'string', 'nullable' => true],
                    'to_state' => ['type' => 'string', 'nullable' => true],
                    'metadata' => ['type' => 'json', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['resource_type', 'resource_id']],
                    ['columns' => ['actor_id']],
                ],
            ],
            'codemart_v1_testimonials' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'quote_key' => ['type' => 'string', 'nullable' => false],
                    'author_label' => ['type' => 'string', 'nullable' => false],
                    'role_label' => ['type' => 'string', 'nullable' => false],
                    'avatar_url' => ['type' => 'string', 'nullable' => true],
                    'approved' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                    'display_order' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                    'quotes' => ['type' => 'json', 'nullable' => true],
                    'role_labels' => ['type' => 'json', 'nullable' => true],
                    'status' => ['type' => 'string', 'nullable' => false, 'default' => 'pending'],
                    'user_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'project_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'moderated_by' => ['type' => 'bigInteger', 'nullable' => true],
                    'moderated_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['approved', 'display_order']],
                    ['columns' => ['status']],
                    ['columns' => ['user_id']],
                ],
            ],
            'codemart_v1_contact_messages' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'name' => ['type' => 'string', 'nullable' => false],
                    'email' => ['type' => 'string', 'nullable' => false],
                    'subject' => ['type' => 'string', 'nullable' => true],
                    'message' => ['type' => 'text', 'nullable' => false],
                    'status' => ['type' => 'string', 'nullable' => false, 'default' => 'new'],
                    'handled_by' => ['type' => 'bigInteger', 'nullable' => true],
                    'handled_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status']],
                ],
            ],
            'codemart_v1_reviewer_applications' => [
                'columns' => [
                    'revoked_at' => ['type' => 'timestamp', 'nullable' => true],
                    'revoked_by' => ['type' => 'bigInteger', 'nullable' => true],
                    'revoke_reason' => ['type' => 'text', 'nullable' => true],
                ],
            ],
            // Additive columns on existing tables (data-preserving).
            'codemart_v1_projects' => [
                'columns' => [
                    'state_revision' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                    'architect_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'published_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status']],
                    ['columns' => ['client_id']],
                ],
            ],
            'codemart_v1_tasks' => [
                'columns' => [
                    'state_revision' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                    'required_skills' => ['type' => 'json', 'nullable' => true],
                    'assigned_at' => ['type' => 'timestamp', 'nullable' => true],
                    'started_at' => ['type' => 'timestamp', 'nullable' => true],
                    'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status', 'assigned_to']],
                ],
            ],
            'codemart_v1_task_submissions' => [
                'columns' => [
                    'reviewed_by' => ['type' => 'bigInteger', 'nullable' => true],
                    'reviewed_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['status']],
                ],
            ],
            'codemart_v1_developer_stats' => [
                'columns' => [
                    'completed_tasks' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                ],
            ],
            'codemart_v1_ai_analyses' => [
                'columns' => [
                    'global_task_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'revision' => ['type' => 'integer', 'nullable' => false, 'default' => 1],
                    'idempotency_key' => ['type' => 'string', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['idempotency_key']],
                    ['columns' => ['global_task_id']],
                ],
            ],
            'codemart_v1_payments' => [
                'columns' => [
                    'idempotency_key' => ['type' => 'string', 'nullable' => true],
                    'business_ref' => ['type' => 'string', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['idempotency_key']],
                    ['columns' => ['business_ref']],
                ],
            ],
            'codemart_v1_deposits' => [
                'columns' => [
                    'idempotency_key' => ['type' => 'string', 'nullable' => true],
                    'admin_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'admin_notes' => ['type' => 'text', 'nullable' => true],
                    'reviewed_at' => ['type' => 'timestamp', 'nullable' => true],
                    'refunded_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['idempotency_key']],
                    ['columns' => ['user_id', 'role_type', 'status']],
                ],
            ],
            'codemart_v1_refunds' => [
                'columns' => [
                    'requested_by' => ['type' => 'bigInteger', 'nullable' => true],
                    'admin_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'admin_notes' => ['type' => 'text', 'nullable' => true],
                    'reviewed_at' => ['type' => 'timestamp', 'nullable' => true],
                    'idempotency_key' => ['type' => 'string', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['requested_by']],
                    ['columns' => ['idempotency_key']],
                ],
            ],
            'codemart_v1_escrows' => [
                'columns' => [
                    'escrow_type' => ['type' => 'string', 'nullable' => true],
                    'released_amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                    'refunded_amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false, 'default' => 0],
                    'idempotency_key' => ['type' => 'string', 'nullable' => true],
                    'metadata' => ['type' => 'json', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['project_id', 'escrow_type', 'status']],
                    ['columns' => ['idempotency_key']],
                ],
            ],
            'codemart_v1_withdrawals' => [
                'columns' => [
                    'id' => ['type' => 'bigIncrements'],
                    'user_id' => ['type' => 'bigInteger', 'nullable' => false],
                    'amount' => ['type' => 'decimal', 'precision' => 15, 'scale' => 2, 'nullable' => false],
                    'currency' => ['type' => 'string', 'nullable' => false, 'default' => CodeMartV1Constants::DEFAULT_CURRENCY],
                    'status' => ['type' => 'string', 'nullable' => false, 'default' => CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING],
                    'method' => ['type' => 'string', 'nullable' => false],
                    'account_info' => ['type' => 'json', 'nullable' => true],
                    'admin_id' => ['type' => 'bigInteger', 'nullable' => true],
                    'admin_notes' => ['type' => 'text', 'nullable' => true],
                    'idempotency_key' => ['type' => 'string', 'nullable' => true],
                    'reviewed_at' => ['type' => 'timestamp', 'nullable' => true],
                    'paid_at' => ['type' => 'timestamp', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['user_id', 'status']],
                    ['columns' => ['status']],
                    ['columns' => ['idempotency_key']],
                ],
            ],
            'codemart_v1_code_reviews' => [
                'columns' => [
                    'quality_rating' => ['type' => 'integer', 'nullable' => true],
                    'readability_rating' => ['type' => 'integer', 'nullable' => true],
                    'efficiency_rating' => ['type' => 'integer', 'nullable' => true],
                    'comments' => ['type' => 'text', 'nullable' => true],
                    'security_rating' => ['type' => 'integer', 'nullable' => true],
                    'review_kind' => ['type' => 'string', 'nullable' => true],
                    'recommendation' => ['type' => 'string', 'nullable' => true],
                    'code_score' => ['type' => 'decimal', 'precision' => 5, 'scale' => 2, 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['reviewer_id']],
                    ['columns' => ['task_submission_id', 'review_kind']],
                ],
            ],
        ];
    }

    private function verifyTables(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::CODEMARTV1);
        $missing = [];

        foreach (self::REQUIRED_TABLES as $tableName) {
            if (!Schema::connection($connection)->hasTable($tableName)) {
                $missing[] = $tableName;
            }
        }

        if ($missing !== []) {
            return [
                'status' => 'error',
                'message' => 'Missing tables: ' . implode(', ', $missing),
                'missing_tables' => $missing,
            ];
        }

        return [
            'status' => 'success',
            'message' => 'All ' . count(self::REQUIRED_TABLES) . ' tables verified',
        ];
    }

    /**
     * Idempotent demo dataset (upserts only), re-applied on every sys:init.
     * Runs in every environment; only an explicit CODEMART_SEED_DEMO=false
     * (services.codemart_seed_demo) turns it off.
     */
    private function seedDemoData(): array
    {
        $configured = config('services.codemart_seed_demo');
        $enabled = $configured === null || $configured === ''
            || filter_var($configured, FILTER_VALIDATE_BOOLEAN);

        if (!$enabled) {
            return [
                'status' => 'skipped',
                'message' => 'Demo seeding disabled (CODEMART_SEED_DEMO=false)',
            ];
        }

        $summary = (new CodeMartV1DemoSeeder())->seed(
            static fn (string $message) => Log::info('[CodeMartV1Init] ' . $message)
        );

        return [
            'status' => 'success',
            'message' => 'Seeded ' . count($summary['accounts']) . ' demo accounts',
            'counts' => $summary['counts'],
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
            return [];
        }

        $decoded = json_decode((string) file_get_contents($this->statusFile), true);

        return is_array($decoded) ? $decoded : [];
    }

    private function markFullyInitialized(): void
    {
        if (!$this->statusFile) {
            return;
        }

        $status = $this->loadStatus();
        $status['fully_initialized'] = true;
        $status['last_run'] = now()->toDateTimeString();

        file_put_contents($this->statusFile, json_encode($status, JSON_PRETTY_PRINT));
    }
}
