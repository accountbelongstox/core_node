<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ActivityModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1AIAnalysisModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ClientProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ContactMessageModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1InvoiceModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1KycVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1NotificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectAttachmentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectProposalModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ReviewerApplicationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskCommentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskSubmissionModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TestimonialModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletTransactionModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WithdrawalModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminFinanceService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1EscrowService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceException;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1ProjectStateService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1RoleRequestService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1TaskStateService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1TestimonialService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * Idempotent CodeMart demo dataset. Every row is upserted on a stable natural
 * key or idempotency key and every money movement goes through the wallet
 * ledger / escrow / admin finance services, so repeated runs converge on the
 * same state without duplicating rows or balances. Nothing is ever deleted.
 */
class CodeMartV1DemoSeeder
{
    public const DEMO_PASSWORD = 'Codemart#2026';
    public const DEMO_EMAIL_DOMAIN = 'codemart.local';
    private const SEED_KEY_PREFIX = 'seed-';
    private const ADMIN_ROLE_LEVEL = 10;
    private const ADMIN_ROLE_NAME = 'admin';
    private const DEMO_LOCALE = 'en';

    private const PATH_FUNDING = 'funding';

    private const ACCOUNTS = [
        'client' => ['username' => 'codemart_demo_client', 'name' => 'Demo Client', 'rolename' => CodeMartV1Constants::ROLE_CLIENT],
        'developer' => ['username' => 'codemart_demo_developer', 'name' => 'Demo Developer', 'rolename' => CodeMartV1Constants::ROLE_DEVELOPER],
        'architect' => ['username' => 'codemart_demo_architect', 'name' => 'Demo Architect', 'rolename' => CodeMartV1Constants::ROLE_ARCHITECT],
        'reviewer' => ['username' => 'codemart_demo_reviewer', 'name' => 'Demo Reviewer', 'rolename' => CodeMartV1Constants::ROLE_REVIEWER],
        'admin' => ['username' => 'codemart_demo_admin', 'name' => 'Demo Administrator', 'rolename' => self::ADMIN_ROLE_NAME, 'rolelevel' => self::ADMIN_ROLE_LEVEL],
        'newdev' => ['username' => 'codemart_demo_newdev', 'name' => 'Demo New Developer', 'rolename' => CodeMartV1Constants::ROLE_DEVELOPER],
        'client2' => ['username' => 'codemart_demo_client2', 'name' => 'Demo Bakery Owner', 'rolename' => CodeMartV1Constants::ROLE_CLIENT],
    ];

    private const ACTIVE_ROLES = [
        'client' => [CodeMartV1Constants::ROLE_CLIENT],
        'client2' => [CodeMartV1Constants::ROLE_CLIENT],
        'developer' => [CodeMartV1Constants::ROLE_DEVELOPER],
        'architect' => [CodeMartV1Constants::ROLE_DEVELOPER, CodeMartV1Constants::ROLE_ARCHITECT],
        'reviewer' => [CodeMartV1Constants::ROLE_REVIEWER],
    ];

    private const CLIENT_PROFILES = [
        'client' => [
            'company_name' => 'Demo Retail Client',
            'industry' => 'Retail',
            'company_description' => 'Regional retail chain modernizing its supply chain and customer-facing tooling.',
            'contact_person' => 'Demo Client',
            'company_website' => 'https://northwind.example.com',
            'average_rating' => 4.6,
        ],
        'client2' => [
            'company_name' => 'Demo Bakery Client',
            'industry' => 'Food & Beverage',
            'company_description' => 'Neighborhood bakery taking its daily orders online.',
            'contact_person' => 'Demo Bakery Owner',
            'company_website' => 'https://goldencrust.example.com',
            'average_rating' => 4.9,
        ],
    ];

    private const DEVELOPER_PROFILES = [
        'developer' => [
            'company_name' => 'Independent',
            'bio' => 'Full-stack engineer focused on Laravel, React and PostgreSQL delivery.',
            'skills' => ['PHP', 'Laravel', 'React', 'TypeScript', 'PostgreSQL', 'Flutter'],
            'certifications' => ['AWS Certified Developer'],
        ],
        'architect' => [
            'company_name' => 'Blueprint Systems',
            'bio' => 'Solution architect leading managed deliveries from requirement analysis to release.',
            'skills' => ['System Design', 'Laravel', 'Flutter', 'Kubernetes', 'PostgreSQL'],
            'certifications' => ['TOGAF 9', 'CKA'],
        ],
        'newdev' => [
            'company_name' => 'Independent',
            'bio' => 'Frontend developer joining the marketplace; deposit awaiting confirmation.',
            'skills' => ['Vue.js', 'TypeScript', 'CSS'],
            'certifications' => [],
        ],
    ];

    private const WALLET_TOP_UPS = [
        'client' => '300000.00',
        'client2' => '30000.00',
        'developer' => '2000.00',
        'architect' => '5000.00',
        'reviewer' => '500.00',
    ];

    private const DEPOSITS = [
        ['user' => 'developer', 'key' => 'seed-developer-deposit-{user}', 'role' => CodeMartV1Constants::ROLE_DEVELOPER, 'amount' => CodeMartV1Constants::DEPOSIT_DEVELOPER, 'method' => CodeMartV1Constants::PAYMENT_METHOD_ALIPAY, 'target' => CodeMartV1Constants::DEPOSIT_STATUS_PAID, 'notes' => null],
        ['user' => 'architect', 'key' => 'seed-architect-deposit-developer-{user}', 'role' => CodeMartV1Constants::ROLE_DEVELOPER, 'amount' => CodeMartV1Constants::DEPOSIT_DEVELOPER, 'method' => CodeMartV1Constants::PAYMENT_METHOD_BANK_TRANSFER, 'target' => CodeMartV1Constants::DEPOSIT_STATUS_PAID, 'notes' => null],
        ['user' => 'architect', 'key' => 'seed-architect-deposit-architect-{user}', 'role' => CodeMartV1Constants::ROLE_ARCHITECT, 'amount' => CodeMartV1Constants::DEPOSIT_ARCHITECT_ADDITIONAL, 'method' => CodeMartV1Constants::PAYMENT_METHOD_BANK_TRANSFER, 'target' => CodeMartV1Constants::DEPOSIT_STATUS_PAID, 'notes' => null],
        ['user' => 'newdev', 'key' => 'seed-newdev-deposit-rejected-{user}', 'role' => CodeMartV1Constants::ROLE_DEVELOPER, 'amount' => CodeMartV1Constants::DEPOSIT_DEVELOPER, 'method' => CodeMartV1Constants::PAYMENT_METHOD_ALIPAY, 'target' => CodeMartV1Constants::DEPOSIT_STATUS_REJECTED, 'notes' => 'Payment was not received within the confirmation window.'],
        ['user' => 'newdev', 'key' => 'seed-newdev-deposit-pending-{user}', 'role' => CodeMartV1Constants::ROLE_DEVELOPER, 'amount' => CodeMartV1Constants::DEPOSIT_DEVELOPER, 'method' => CodeMartV1Constants::PAYMENT_METHOD_BANK_TRANSFER, 'target' => CodeMartV1Constants::DEPOSIT_STATUS_PENDING, 'notes' => null],
    ];

    private const KYC_RECORDS = [
        ['user' => 'developer', 'identity_number' => 'DEMO-KYC-DEVELOPER-0001', 'identity_type' => CodeMartV1Constants::IDENTITY_TYPE_ID_CARD, 'real_name' => 'Demo Developer', 'date_of_birth' => '1992-04-18', 'target' => CodeMartV1Constants::KYC_STATUS_APPROVED],
        ['user' => 'newdev', 'identity_number' => 'DEMO-KYC-NEWDEV-0001', 'identity_type' => CodeMartV1Constants::IDENTITY_TYPE_PASSPORT, 'real_name' => 'Demo New Developer', 'date_of_birth' => '1998-09-02', 'target' => CodeMartV1Constants::KYC_STATUS_PENDING],
    ];

    private const REVIEWER_APPLICATIONS = [
        ['user' => 'reviewer', 'status' => CodeMartV1Constants::REVIEWER_APPLICATION_PASSED, 'similarity' => 92.5],
        ['user' => 'newdev', 'status' => CodeMartV1Constants::REVIEWER_APPLICATION_FAILED, 'similarity' => 61.0],
    ];

    private const REVIEWER_TEST_CASES = [
        ['id' => 1, 'language' => 'php', 'code' => 'function sum(array $values): int { return array_sum($values); }', 'expected_quality' => 5, 'expected_readability' => 5, 'expected_efficiency' => 5],
        ['id' => 2, 'language' => 'javascript', 'code' => 'for (var i = 0; i < list.length; i++) { for (var j = 0; j < list.length; j++) { if (list[i] === list[j] && i !== j) dup = true; } }', 'expected_quality' => 2, 'expected_readability' => 3, 'expected_efficiency' => 1],
        ['id' => 3, 'language' => 'python', 'code' => 'def load(path):\n    with open(path) as handle:\n        return [line.strip() for line in handle]', 'expected_quality' => 4, 'expected_readability' => 5, 'expected_efficiency' => 4],
    ];

    private const PROJECTS = [
        [
            'key' => 'chatbot',
            'client' => 'client',
            'title' => 'AI Customer Support Chatbot',
            'description' => 'Support chatbot trained on the help-center corpus with human handoff and satisfaction tracking. Awaiting AI requirement analysis.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_DRAFT,
            'complexity' => CodeMartV1Constants::COMPLEXITY_COMPLEX,
            'budget' => 58000,
            'skills' => ['Python', 'Laravel', 'React'],
            'languages' => ['Python', 'PHP', 'TypeScript'],
            'frameworks' => ['Laravel', 'React'],
            'databases' => ['PostgreSQL'],
            'start_days' => 30,
            'duration_days' => 120,
        ],
        [
            'key' => 'clinic',
            'client' => 'client',
            'title' => 'Clinic Appointment Booking System',
            'description' => 'Online booking for a network of clinics with doctor calendars, SMS reminders and a patient portal. AI proposal ready for review.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW,
            'complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'budget' => 36000,
            'skills' => ['Laravel', 'Vue.js', 'PostgreSQL'],
            'languages' => ['PHP', 'TypeScript'],
            'frameworks' => ['Laravel', 'Vue.js'],
            'databases' => ['PostgreSQL', 'Redis'],
            'start_days' => 14,
            'duration_days' => 90,
            'analysis' => ['hours' => 450, 'cost' => 36000, 'complexity_score' => 4.2, 'languages' => ['PHP', 'TypeScript'], 'frameworks' => ['Laravel', 'Vue.js'], 'databases' => ['PostgreSQL', 'Redis'], 'team' => ['1x Senior', '1x Mid-level'], 'keywords' => ['web', 'backend']],
            'attachment' => ['name' => 'clinic-requirements.txt', 'content' => "Clinic booking requirements\n- Doctor calendars per clinic\n- Patient self-service booking and cancellation\n- SMS reminders 24h before the appointment\n- Admin reporting of no-show rates\n"],
        ],
        [
            'key' => 'logistics',
            'client' => 'client',
            'title' => 'Logistics Route Optimization Engine',
            'description' => 'Route planning service that cuts delivery mileage across the regional fleet. Proposal accepted; funding confirmation pending.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING,
            'complexity' => CodeMartV1Constants::COMPLEXITY_VERY_COMPLEX,
            'budget' => 96000,
            'skills' => ['Python', 'PostgreSQL'],
            'languages' => ['Python', 'Go'],
            'frameworks' => ['Django', 'Gin'],
            'databases' => ['PostgreSQL'],
            'start_days' => 21,
            'duration_days' => 150,
            'analysis' => ['hours' => 1200, 'cost' => 96000, 'complexity_score' => 7.8, 'languages' => ['Python', 'Go'], 'frameworks' => ['Django', 'Gin'], 'databases' => ['PostgreSQL'], 'team' => ['1x Senior', '2x Mid-level'], 'keywords' => ['backend', 'realtime']],
        ],
        [
            'key' => 'inventory',
            'client' => 'client',
            'title' => 'Smart Inventory Management Platform',
            'description' => 'Barcode-driven stock tracking with movement auditing, warehouse dashboards and exportable reports for a regional retail chain.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_OPEN,
            'complexity' => CodeMartV1Constants::COMPLEXITY_COMPLEX,
            'budget' => 46000,
            'skills' => ['PHP', 'Laravel', 'React', 'PostgreSQL'],
            'languages' => ['PHP', 'TypeScript'],
            'frameworks' => ['Laravel', 'React'],
            'databases' => ['PostgreSQL'],
            'start_days' => 3,
            'duration_days' => 80,
            'analysis' => ['hours' => 575, 'cost' => 46000, 'complexity_score' => 5.6, 'languages' => ['PHP', 'TypeScript'], 'frameworks' => ['Laravel', 'React'], 'databases' => ['PostgreSQL'], 'team' => ['1x Senior', '2x Mid-level'], 'keywords' => ['web', 'backend']],
            'milestones' => [
                [
                    'title' => 'Backend foundation',
                    'description' => 'Inventory schema, stock movement API and barcode endpoints.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_PENDING,
                    'budget' => 21000,
                    'due_days' => 45,
                    'deliverables' => ['Inventory schema migration', 'Stock movement REST API', 'Barcode scan endpoint'],
                    'tasks' => [
                        ['title' => 'Design inventory schema', 'description' => 'Normalized schema for warehouses, items, stock levels and movement audit trails.', 'status' => CodeMartV1Constants::TASK_STATUS_OPEN, 'priority' => CodeMartV1Constants::TASK_PRIORITY_HIGH, 'budget' => 3000, 'due_days' => 10, 'skills' => ['PostgreSQL']],
                        ['title' => 'Implement stock movement API', 'description' => 'Transactional in/out/transfer endpoints with idempotency and audit logging.', 'status' => CodeMartV1Constants::TASK_STATUS_OPEN, 'priority' => CodeMartV1Constants::TASK_PRIORITY_URGENT, 'budget' => 8000, 'due_days' => 25, 'skills' => ['PHP', 'Laravel']],
                        ['title' => 'Build barcode scanning endpoint', 'description' => 'Scan-to-movement endpoint with batch support and offline conflict resolution.', 'status' => CodeMartV1Constants::TASK_STATUS_OPEN, 'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM, 'budget' => 10000, 'due_days' => 40, 'skills' => ['PHP', 'Laravel']],
                    ],
                ],
                [
                    'title' => 'Frontend dashboards',
                    'description' => 'Warehouse overview dashboard and reporting UI.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_PENDING,
                    'budget' => 25000,
                    'due_days' => 75,
                    'deliverables' => ['Warehouse overview dashboard', 'Report builder with CSV/XLSX export'],
                    'tasks' => [
                        ['title' => 'Inventory overview dashboard', 'description' => 'Real-time stock dashboard with warehouse filters and low-stock alerts.', 'status' => CodeMartV1Constants::TASK_STATUS_PENDING, 'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM, 'budget' => 14000, 'due_days' => 60, 'skills' => ['React', 'TypeScript']],
                        ['title' => 'Reports and export UI', 'description' => 'Report builder with CSV/XLSX export for movements and stock levels.', 'status' => CodeMartV1Constants::TASK_STATUS_PENDING, 'priority' => CodeMartV1Constants::TASK_PRIORITY_LOW, 'budget' => 11000, 'due_days' => 70, 'skills' => ['React']],
                    ],
                ],
            ],
        ],
        [
            'key' => 'fitness',
            'client' => 'client',
            'architect' => 'architect',
            'title' => 'Mobile Fitness Tracking Application',
            'description' => 'Cross-platform fitness app with workout plans, progress charts and wearable sync, delivered through the managed architect flow.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS,
            'complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'budget' => 32000,
            'skills' => ['Flutter', 'Dart', 'Laravel'],
            'languages' => ['Dart', 'PHP'],
            'frameworks' => ['Flutter', 'Laravel'],
            'databases' => ['PostgreSQL'],
            'start_days' => -20,
            'duration_days' => 70,
            'analysis' => ['hours' => 400, 'cost' => 32000, 'complexity_score' => 4.8, 'languages' => ['Dart', 'PHP'], 'frameworks' => ['Flutter', 'Laravel'], 'databases' => ['PostgreSQL'], 'team' => ['1x Mid-level', '1x Junior'], 'keywords' => ['mobile', 'backend']],
            'milestones' => [
                [
                    'title' => 'MVP release',
                    'description' => 'Core tracking, plans and charting for the first store release.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_IN_PROGRESS,
                    'budget' => 20000,
                    'due_days' => 30,
                    'deliverables' => ['Workout plan engine', 'Progress charts', 'Wearable sync', 'Push notifications'],
                    'tasks' => [
                        [
                            'title' => 'Workout plan engine',
                            'description' => 'Plan templates, scheduling and progression rules exposed via API.',
                            'status' => CodeMartV1Constants::TASK_STATUS_COMPLETED,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_HIGH,
                            'assignee' => 'developer',
                            'budget' => 6000,
                            'due_days' => 20,
                            'skills' => ['Laravel'],
                            'submissions' => [
                                [
                                    'note' => 'First iteration of the plan engine with template CRUD and weekly scheduling.',
                                    'files' => [['name' => 'Pull request #12', 'url' => 'https://git.example.com/fitness/plan-engine/pull/12', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_NEEDS_REVISION,
                                    'client_review' => ['status' => CodeMartV1Constants::SUBMISSION_STATUS_NEEDS_REVISION, 'rating' => 3, 'notes' => 'Progression rules are missing deload weeks; please add them and cover them with tests.'],
                                ],
                                [
                                    'note' => 'Added deload weeks, progression tests and API documentation.',
                                    'files' => [['name' => 'Pull request #15', 'url' => 'https://git.example.com/fitness/plan-engine/pull/15', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED,
                                    'reviewer_review' => ['quality' => 5, 'readability' => 4, 'efficiency' => 4, 'security' => 5, 'recommendation' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'comments' => 'Clean service boundaries, good test coverage of the progression rules and safe input validation.'],
                                    'client_review' => ['status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'rating' => 5, 'notes' => 'Works as specified, approved for release.'],
                                ],
                            ],
                            'comments' => [
                                ['user' => 'architect', 'text' => 'Please keep the progression rules configurable per plan template.'],
                                ['user' => 'developer', 'text' => 'Done, rules now live in the template settings with sensible defaults.'],
                            ],
                        ],
                        [
                            'title' => 'Progress charts',
                            'description' => 'Weekly and monthly progress visualizations with trend lines.',
                            'status' => CodeMartV1Constants::TASK_STATUS_REVIEW,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM,
                            'assignee' => 'developer',
                            'budget' => 5000,
                            'due_days' => 25,
                            'skills' => ['Flutter', 'Dart'],
                            'submissions' => [
                                [
                                    'note' => 'Weekly and monthly charts with trend lines and empty-state handling.',
                                    'files' => [['name' => 'Pull request #18', 'url' => 'https://git.example.com/fitness/app/pull/18', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
                                    'reviewer_review' => ['quality' => 4, 'readability' => 4, 'efficiency' => 3, 'security' => 4, 'recommendation' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'comments' => 'Charts render correctly; consider caching the aggregated series to avoid recomputation on every rebuild.'],
                                ],
                            ],
                            'comments' => [
                                ['user' => 'client', 'text' => 'Could the monthly view also show the personal best line?'],
                            ],
                        ],
                        ['title' => 'Wearable sync service', 'description' => 'Background sync with Apple Health and Google Fit including conflict resolution.', 'status' => CodeMartV1Constants::TASK_STATUS_IN_PROGRESS, 'priority' => CodeMartV1Constants::TASK_PRIORITY_HIGH, 'assignee' => 'developer', 'budget' => 5000, 'due_days' => 28, 'skills' => ['Flutter', 'Kotlin', 'Swift']],
                        [
                            'title' => 'Push notification scheduler',
                            'description' => 'Workout reminders and streak notifications with quiet hours.',
                            'status' => CodeMartV1Constants::TASK_STATUS_BLOCKED,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM,
                            'assignee' => 'developer',
                            'budget' => 4000,
                            'due_days' => 30,
                            'skills' => ['Firebase', 'Laravel'],
                            'comments' => [
                                ['user' => 'developer', 'text' => 'Blocked until the Firebase project credentials are provided by the client.'],
                            ],
                        ],
                    ],
                ],
                [
                    'title' => 'Store launch',
                    'description' => 'Onboarding, localization and the store release pipeline.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_IN_PROGRESS,
                    'budget' => 12000,
                    'due_days' => 55,
                    'deliverables' => ['Onboarding flow', 'Localized store listing', 'Automated release pipeline'],
                    'tasks' => [
                        ['title' => 'App store release pipeline', 'description' => 'CI pipeline producing signed builds for both stores with staged rollout.', 'status' => CodeMartV1Constants::TASK_STATUS_ASSIGNED, 'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM, 'assignee' => 'developer', 'budget' => 4000, 'due_days' => 50, 'skills' => ['CI/CD', 'Fastlane']],
                        [
                            'title' => 'Onboarding flow UI',
                            'description' => 'Three-step onboarding capturing goals, fitness level and reminder preferences.',
                            'status' => CodeMartV1Constants::TASK_STATUS_REVIEW,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM,
                            'assignee' => 'developer',
                            'budget' => 4000,
                            'due_days' => 45,
                            'skills' => ['Flutter'],
                            'submissions' => [
                                [
                                    'note' => 'Onboarding screens with goal selection and reminder opt-in.',
                                    'files' => [['name' => 'Pull request #21', 'url' => 'https://git.example.com/fitness/app/pull/21', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
                                ],
                            ],
                        ],
                        ['title' => 'Localization pass', 'description' => 'Extract all strings and deliver English and Chinese translations.', 'status' => CodeMartV1Constants::TASK_STATUS_OPEN, 'priority' => CodeMartV1Constants::TASK_PRIORITY_LOW, 'budget' => 4000, 'due_days' => 52, 'skills' => ['Flutter', 'i18n']],
                    ],
                ],
            ],
        ],
        [
            'key' => 'iot',
            'client' => 'client',
            'title' => 'Warehouse IoT Sensor Dashboard',
            'description' => 'Temperature and humidity sensor ingestion with alerting for cold-chain warehouses. Paused while hardware procurement completes.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_PAUSED,
            'complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'budget' => 18000,
            'skills' => ['Go', 'React', 'PostgreSQL'],
            'languages' => ['Go', 'TypeScript'],
            'frameworks' => ['Gin', 'React'],
            'databases' => ['PostgreSQL', 'Redis'],
            'start_days' => -10,
            'duration_days' => 60,
            'analysis' => ['hours' => 225, 'cost' => 18000, 'complexity_score' => 4.1, 'languages' => ['Go', 'TypeScript'], 'frameworks' => ['Gin', 'React'], 'databases' => ['PostgreSQL', 'Redis'], 'team' => ['1x Mid-level', '1x Junior'], 'keywords' => ['backend', 'realtime', 'web']],
            'milestones' => [
                [
                    'title' => 'Ingestion and alerting',
                    'description' => 'Sensor ingestion API and alert rule management.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_IN_PROGRESS,
                    'budget' => 18000,
                    'due_days' => 40,
                    'deliverables' => ['Sensor ingestion API', 'Alert rules UI'],
                    'tasks' => [
                        ['title' => 'Sensor ingestion API', 'description' => 'High-throughput ingestion endpoint with batching and device authentication.', 'status' => CodeMartV1Constants::TASK_STATUS_IN_PROGRESS, 'priority' => CodeMartV1Constants::TASK_PRIORITY_HIGH, 'assignee' => 'developer', 'budget' => 10000, 'due_days' => 30, 'skills' => ['Go', 'PostgreSQL']],
                        ['title' => 'Alert rules UI', 'description' => 'Threshold and escalation rule editor with notification channels.', 'status' => CodeMartV1Constants::TASK_STATUS_OPEN, 'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM, 'budget' => 8000, 'due_days' => 38, 'skills' => ['React']],
                    ],
                ],
            ],
        ],
        [
            'key' => 'website',
            'client' => 'client',
            'title' => 'Corporate Website Redesign',
            'description' => 'Responsive marketing site refresh with localized content and analytics instrumentation.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_COMPLETED,
            'complexity' => CodeMartV1Constants::COMPLEXITY_SIMPLE,
            'budget' => 12000,
            'skills' => ['React', 'TypeScript'],
            'languages' => ['TypeScript'],
            'frameworks' => ['React'],
            'databases' => [],
            'start_days' => -60,
            'duration_days' => 30,
            'analysis' => ['hours' => 150, 'cost' => 12000, 'complexity_score' => 2.3, 'languages' => ['TypeScript'], 'frameworks' => ['React'], 'databases' => [], 'team' => ['1x Mid-level'], 'keywords' => ['web']],
            'milestones' => [
                [
                    'title' => 'Launch',
                    'description' => 'Full redesign delivered and deployed.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_COMPLETED,
                    'budget' => 12000,
                    'due_days' => 7,
                    'deliverables' => ['Responsive page templates', 'Analytics event plan', 'Production deployment'],
                    'tasks' => [
                        [
                            'title' => 'Responsive page rebuild',
                            'description' => 'Rebuild all public pages with the unified shell and mobile adaptation.',
                            'status' => CodeMartV1Constants::TASK_STATUS_COMPLETED,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_MEDIUM,
                            'assignee' => 'developer',
                            'budget' => 8000,
                            'due_days' => 5,
                            'skills' => ['React'],
                            'submissions' => [
                                [
                                    'note' => 'All pages rebuilt with the unified shell; Lighthouse mobile score 96.',
                                    'files' => [['name' => 'Release notes', 'url' => 'https://git.example.com/northwind/site/releases/v2.0.0', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED,
                                    'reviewer_review' => ['quality' => 5, 'readability' => 5, 'efficiency' => 4, 'security' => 4, 'recommendation' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'comments' => 'Consistent component structure and accessible markup across every rebuilt page.'],
                                    'client_review' => ['status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'rating' => 5, 'notes' => 'Great result, the site is much faster.'],
                                ],
                            ],
                        ],
                        [
                            'title' => 'Analytics instrumentation',
                            'description' => 'Privacy-aware event tracking for the marketing funnel.',
                            'status' => CodeMartV1Constants::TASK_STATUS_COMPLETED,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_LOW,
                            'assignee' => 'developer',
                            'budget' => 4000,
                            'due_days' => 6,
                            'skills' => ['TypeScript'],
                            'submissions' => [
                                [
                                    'note' => 'Funnel events wired with consent gating and a tracking plan document.',
                                    'files' => [['name' => 'Tracking plan', 'url' => 'https://git.example.com/northwind/site/wiki/tracking-plan', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED,
                                    'client_review' => ['status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'rating' => 4, 'notes' => 'Approved; consent banner works as expected.'],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ],
        [
            'key' => 'crm',
            'client' => 'client',
            'title' => 'Legacy CRM Data Migration',
            'description' => 'Migration of fifteen years of CRM records into the new platform. Cancelled after the vendor contract was extended.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_CANCELLED,
            'complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'budget' => 24000,
            'skills' => ['Python', 'SQL'],
            'languages' => ['Python', 'SQL'],
            'frameworks' => [],
            'databases' => ['PostgreSQL', 'MySQL'],
            'start_days' => -30,
            'duration_days' => 45,
            'analysis' => ['hours' => 300, 'cost' => 24000, 'complexity_score' => 3.9, 'languages' => ['Python'], 'frameworks' => ['Django'], 'databases' => ['PostgreSQL', 'MySQL'], 'team' => ['1x Mid-level', '1x Junior'], 'keywords' => ['backend']],
        ],
        [
            'key' => 'holiday',
            'client' => 'client',
            'title' => 'Holiday Campaign Landing Pages',
            'description' => 'Seasonal campaign landing pages with A/B tested hero sections. Delivered and archived after the campaign ended.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_ARCHIVED,
            'complexity' => CodeMartV1Constants::COMPLEXITY_SIMPLE,
            'budget' => 6000,
            'skills' => ['HTML', 'CSS', 'JavaScript'],
            'languages' => ['JavaScript'],
            'frameworks' => ['Astro'],
            'databases' => [],
            'start_days' => -120,
            'duration_days' => 20,
            'analysis' => ['hours' => 75, 'cost' => 6000, 'complexity_score' => 1.6, 'languages' => ['JavaScript'], 'frameworks' => ['Astro'], 'databases' => [], 'team' => ['1x Junior'], 'keywords' => ['web']],
            'milestones' => [
                [
                    'title' => 'Campaign delivery',
                    'description' => 'Landing pages live before the campaign start.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_COMPLETED,
                    'budget' => 6000,
                    'due_days' => 5,
                    'deliverables' => ['Three landing page variants', 'A/B test configuration'],
                    'tasks' => [
                        [
                            'title' => 'Campaign landing pages',
                            'description' => 'Three hero variants with countdown, coupon capture and A/B test wiring.',
                            'status' => CodeMartV1Constants::TASK_STATUS_COMPLETED,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_HIGH,
                            'assignee' => 'developer',
                            'budget' => 6000,
                            'due_days' => 4,
                            'skills' => ['HTML', 'CSS', 'JavaScript'],
                            'submissions' => [
                                [
                                    'note' => 'Variants A/B/C deployed with the experiment flags.',
                                    'files' => [['name' => 'Preview', 'url' => 'https://preview.example.com/holiday', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED,
                                    'client_review' => ['status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'rating' => 4, 'notes' => 'Delivered on time for the campaign.'],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ],
        [
            'key' => 'bakery',
            'client' => 'client2',
            'title' => 'Bakery Online Ordering Site',
            'description' => 'Pre-order storefront with pickup slots and daily menu management for a neighborhood bakery.',
            'target' => CodeMartV1Constants::PROJECT_STATUS_COMPLETED,
            'complexity' => CodeMartV1Constants::COMPLEXITY_SIMPLE,
            'budget' => 9000,
            'skills' => ['Laravel', 'Vue.js'],
            'languages' => ['PHP', 'TypeScript'],
            'frameworks' => ['Laravel', 'Vue.js'],
            'databases' => ['PostgreSQL'],
            'start_days' => -45,
            'duration_days' => 25,
            'analysis' => ['hours' => 112, 'cost' => 9000, 'complexity_score' => 2.1, 'languages' => ['PHP', 'TypeScript'], 'frameworks' => ['Laravel', 'Vue.js'], 'databases' => ['PostgreSQL'], 'team' => ['1x Mid-level'], 'keywords' => ['web', 'backend']],
            'milestones' => [
                [
                    'title' => 'Storefront launch',
                    'description' => 'Ordering storefront with pickup slots.',
                    'status' => CodeMartV1Constants::MILESTONE_STATUS_COMPLETED,
                    'budget' => 9000,
                    'due_days' => 10,
                    'deliverables' => ['Menu management', 'Pickup slot booking', 'Order notifications'],
                    'tasks' => [
                        [
                            'title' => 'Online ordering storefront',
                            'description' => 'Menu, cart, pickup slot selection and order confirmation emails.',
                            'status' => CodeMartV1Constants::TASK_STATUS_COMPLETED,
                            'priority' => CodeMartV1Constants::TASK_PRIORITY_HIGH,
                            'assignee' => 'developer',
                            'budget' => 9000,
                            'due_days' => 8,
                            'skills' => ['Laravel', 'Vue.js'],
                            'submissions' => [
                                [
                                    'note' => 'Storefront live with pickup slots and confirmation emails.',
                                    'files' => [['name' => 'Staging site', 'url' => 'https://staging.goldencrust.example.com', 'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK]],
                                    'status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED,
                                    'reviewer_review' => ['quality' => 4, 'readability' => 5, 'efficiency' => 4, 'security' => 4, 'recommendation' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'comments' => 'Straightforward Laravel structure, validated checkout inputs and clear Vue components.'],
                                    'client_review' => ['status' => CodeMartV1Constants::SUBMISSION_STATUS_APPROVED, 'rating' => 5, 'notes' => 'Orders started coming in the first day, thank you!'],
                                ],
                            ],
                            'comments' => [
                                ['user' => 'client2', 'text' => 'Can we close pickup slots automatically on public holidays?'],
                                ['user' => 'developer', 'text' => 'Added a holiday calendar; slots close automatically on listed dates.'],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    private const WALLET_PAYMENTS = [
        ['key' => 'seed-payment-bonus-disputed', 'payer' => 'client', 'payee' => 'developer', 'project' => 'website', 'amount' => '1500.00', 'type' => CodeMartV1Constants::PAYMENT_TYPE_BONUS, 'description' => 'Bonus for the early delivery of the website redesign'],
        ['key' => 'seed-payment-bonus-bakery', 'payer' => 'client2', 'payee' => 'developer', 'project' => 'bakery', 'amount' => '500.00', 'type' => CodeMartV1Constants::PAYMENT_TYPE_BONUS, 'description' => 'Thank-you bonus for the storefront launch'],
    ];

    private const REFUND_REQUESTS = [
        ['key' => 'seed-refund-bonus-disputed', 'payment' => 'seed-payment-bonus-disputed', 'reason' => 'Bonus was sent twice by mistake; the second transfer should be returned.', 'notes' => 'Duplicate of the bonus agreed in the kickoff call.'],
    ];

    private const INVOICES = [
        ['number' => 'INV-DEMO-WEBSITE-PAGES', 'business_ref_task' => ['website', 'Responsive page rebuild'], 'status' => CodeMartV1Constants::INVOICE_STATUS_PAID, 'description' => 'Responsive page rebuild milestone'],
        ['number' => 'INV-DEMO-WEBSITE-ANALYTICS', 'business_ref_task' => ['website', 'Analytics instrumentation'], 'status' => CodeMartV1Constants::INVOICE_STATUS_SENT, 'description' => 'Analytics instrumentation milestone'],
        ['number' => 'INV-DEMO-BAKERY-BONUS', 'payment' => 'seed-payment-bonus-bakery', 'status' => CodeMartV1Constants::INVOICE_STATUS_SENT, 'description' => 'Storefront launch bonus'],
    ];

    private const WITHDRAWALS = [
        ['key' => 'seed-withdrawal-paid', 'user' => 'developer', 'amount' => '3000.00', 'method' => 'bank_transfer', 'account' => ['bank_name' => 'Demo Bank', 'account_name' => 'Demo Developer', 'account_number' => '6222000000001234'], 'target' => CodeMartV1Constants::WITHDRAWAL_STATUS_PAID, 'notes' => 'Transferred in the weekly payout batch.'],
        ['key' => 'seed-withdrawal-approved', 'user' => 'developer', 'amount' => '800.00', 'method' => 'alipay', 'account' => ['account' => 'demo-developer@alipay.example'], 'target' => CodeMartV1Constants::WITHDRAWAL_STATUS_APPROVED, 'notes' => 'Approved for the next payout batch.'],
        ['key' => 'seed-withdrawal-pending', 'user' => 'developer', 'amount' => '1200.00', 'method' => 'wechat', 'account' => ['account' => 'demo_developer_wechat'], 'target' => CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING, 'notes' => null],
    ];

    private const TESTIMONIALS = [
        [
            'quote_key' => 'CodeMart turned our inventory brief into a managed delivery with verified reviewers at every step. The escrowed milestones kept the budget predictable.',
            'quotes' => [
                'en' => 'CodeMart turned our inventory brief into a managed delivery with verified reviewers at every step. The escrowed milestones kept the budget predictable.',
                'zh' => '码市把我们的库存需求变成了全程托管的交付，每一步都有认证评审把关。托管的里程碑让预算始终可控。',
            ],
            'author_label' => 'Operations Director, retail client',
            'role_label' => 'Client',
            'role_labels' => ['en' => 'Client', 'zh' => '客户'],
            'display_order' => 1,
            'user' => 'client',
            'project' => 'website',
        ],
        [
            'quote_key' => 'The marketplace matching is fair: tasks are scoped, priced and reviewed. I know exactly what done means before I accept.',
            'quotes' => [
                'en' => 'The marketplace matching is fair: tasks are scoped, priced and reviewed. I know exactly what done means before I accept.',
                'zh' => '任务市场的匹配很公平：任务范围清晰、定价明确、有评审。接单之前我就清楚什么才算完成。',
            ],
            'author_label' => 'Full-stack Engineer',
            'role_label' => 'Developer',
            'role_labels' => ['en' => 'Developer', 'zh' => '开发者'],
            'display_order' => 2,
        ],
        [
            'quote_key' => 'As an architect I get clean requirements from the AI analysis cycle and a review pipeline that protects delivery quality.',
            'quotes' => [
                'en' => 'As an architect I get clean requirements from the AI analysis cycle and a review pipeline that protects delivery quality.',
                'zh' => '作为架构师，我能从 AI 分析流程拿到清晰的需求，评审流水线也保障了交付质量。',
            ],
            'author_label' => 'Solution Architect',
            'role_label' => 'Architect',
            'role_labels' => ['en' => 'Architect', 'zh' => '架构师'],
            'display_order' => 3,
        ],
    ];

    private const PENDING_TESTIMONIALS = [
        [
            'user' => 'client2',
            'project' => 'bakery',
            'author_label' => 'Owner, bakery client',
            'role_label' => 'Client',
            'quotes' => [
                'en' => 'Our bakery went online in three weeks. The escrow gave us confidence and the developer was great to work with.',
                'zh' => '我们的面包店三周就上线了线上订购。资金托管让我们很放心，开发者合作也非常愉快。',
            ],
            'role_labels' => ['en' => 'Client', 'zh' => '客户'],
        ],
    ];

    private const CONTACT_MESSAGES = [
        ['name' => 'Alex Morgan', 'email' => 'alex.morgan@example.com', 'subject' => 'Enterprise onboarding', 'message' => 'We are evaluating CodeMart for a 12-month program with several parallel projects. Could someone walk us through the escrow and reviewer process?', 'handled' => false],
        ['name' => 'Li Wei', 'email' => 'li.wei@example.com', 'subject' => 'Invoice format question', 'message' => 'Can invoices include our VAT registration number? Our finance team needs it for reimbursement.', 'handled' => true],
    ];

    private const READ_NOTIFICATION_KEYS = [
        'notifications.depositConfirmed',
        'notifications.roleStatusChanged',
        'notifications.projectFunded',
        'notifications.analysisCompleted',
        'notifications.kycApproved',
        'notifications.taskAccepted',
    ];

    private const PROJECT_STATUS_PATHS = [
        CodeMartV1Constants::PROJECT_STATUS_DRAFT => [],
        CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW],
        CodeMartV1Constants::PROJECT_STATUS_CANCELLED => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_CANCELLED],
        CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING],
        CodeMartV1Constants::PROJECT_STATUS_OPEN => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, self::PATH_FUNDING],
        CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, self::PATH_FUNDING, CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS],
        CodeMartV1Constants::PROJECT_STATUS_PAUSED => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, self::PATH_FUNDING, CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS, CodeMartV1Constants::PROJECT_STATUS_PAUSED],
        CodeMartV1Constants::PROJECT_STATUS_COMPLETED => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, self::PATH_FUNDING, CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS, CodeMartV1Constants::PROJECT_STATUS_COMPLETED],
        CodeMartV1Constants::PROJECT_STATUS_ARCHIVED => [CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, self::PATH_FUNDING, CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS, CodeMartV1Constants::PROJECT_STATUS_COMPLETED, CodeMartV1Constants::PROJECT_STATUS_ARCHIVED],
    ];

    private const PROJECT_OWNER_STATUSES = [
        CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING,
        CodeMartV1Constants::PROJECT_STATUS_PAUSED,
        CodeMartV1Constants::PROJECT_STATUS_COMPLETED,
        CodeMartV1Constants::PROJECT_STATUS_CANCELLED,
        CodeMartV1Constants::PROJECT_STATUS_ARCHIVED,
    ];

    private const TASK_STARTED_STATUSES = [
        CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
        CodeMartV1Constants::TASK_STATUS_REVIEW,
        CodeMartV1Constants::TASK_STATUS_BLOCKED,
        CodeMartV1Constants::TASK_STATUS_COMPLETED,
    ];

    private const COUNTED_MODELS = [
        'user_roles' => CodeMartV1UserRoleModel::class,
        'client_profiles' => CodeMartV1ClientProfileModel::class,
        'developer_profiles' => CodeMartV1DeveloperProfileModel::class,
        'developer_stats' => CodeMartV1DeveloperStatsModel::class,
        'kyc_verifications' => CodeMartV1KycVerificationModel::class,
        'reviewer_applications' => CodeMartV1ReviewerApplicationModel::class,
        'wallets' => CodeMartV1WalletModel::class,
        'wallet_transactions' => CodeMartV1WalletTransactionModel::class,
        'deposits' => CodeMartV1DepositModel::class,
        'projects' => CodeMartV1ProjectModel::class,
        'ai_analyses' => CodeMartV1AIAnalysisModel::class,
        'project_proposals' => CodeMartV1ProjectProposalModel::class,
        'project_attachments' => CodeMartV1ProjectAttachmentModel::class,
        'milestones' => CodeMartV1MilestoneModel::class,
        'tasks' => CodeMartV1TaskModel::class,
        'task_submissions' => CodeMartV1TaskSubmissionModel::class,
        'code_reviews' => CodeMartV1CodeReviewModel::class,
        'task_comments' => CodeMartV1TaskCommentModel::class,
        'escrows' => CodeMartV1EscrowModel::class,
        'payments' => CodeMartV1PaymentModel::class,
        'refunds' => CodeMartV1RefundModel::class,
        'invoices' => CodeMartV1InvoiceModel::class,
        'withdrawals' => CodeMartV1WithdrawalModel::class,
        'notifications' => CodeMartV1NotificationModel::class,
        'activities' => CodeMartV1ActivityModel::class,
        'testimonials' => CodeMartV1TestimonialModel::class,
        'contact_messages' => CodeMartV1ContactMessageModel::class,
    ];

    /** @var array<string, int> account key => user id */
    private array $users = [];

    /** @var array<string, CodeMartV1ProjectModel> project key => project */
    private array $projects = [];

    /** @var array<string, CodeMartV1PaymentModel> payment seed key => payment */
    private array $payments = [];

    /** @var callable|null */
    private $log = null;

    private ?CodeMartV1AdminService $adminService = null;

    private ?CodeMartV1AdminFinanceService $adminFinanceService = null;

    public function seed(?callable $log = null): array
    {
        $this->log = $log;
        $this->adminService = app(CodeMartV1AdminService::class);
        $this->adminFinanceService = new CodeMartV1AdminFinanceService();

        $this->seedAccounts();
        $this->seedProfiles();
        $this->seedRolesAndDeposits();
        $this->seedKyc();
        $this->seedReviewerApplications();
        $this->seedWallets();
        foreach (self::PROJECTS as $definition) {
            $this->seedProject($definition);
        }
        $this->seedWalletPayments();
        $this->seedRefundRequests();
        $this->seedInvoices();
        $this->seedWithdrawals();
        $this->seedTestimonials();
        $this->seedContactMessages();
        $this->seedStats();
        $this->markNotificationsRead();
        app(CodeMartV1PublicHomeService::class)->forget();

        return [
            'accounts' => array_map(static fn (array $account): string => $account['username'], self::ACCOUNTS),
            'password' => self::DEMO_PASSWORD,
            'counts' => $this->tableCounts(),
        ];
    }

    private function log(string $message): void
    {
        if ($this->log !== null) {
            ($this->log)($message);
        }
    }

    private function adminId(): int
    {
        return $this->users['admin'];
    }

    private function warnOnFailure(string $context, mixed $result): void
    {
        if (is_array($result) && isset($result['error_code'])) {
            $this->log("Warning: {$context} returned {$result['error_code']}");
        }
    }

    private function emitOnce(
        ?int $actorId,
        string $resourceType,
        int $resourceId,
        string $action,
        ?string $fromState,
        ?string $toState,
        array $notifyUserIds = [],
        ?string $notificationType = null,
        ?string $titleKey = null,
        array $params = []
    ): void {
        $exists = CodeMartV1ActivityModel::query()
            ->where('resource_type', $resourceType)
            ->where('resource_id', $resourceId)
            ->where('action', $action)
            ->exists();
        if ($exists) {
            return;
        }

        CodeMartV1DomainEventService::emit(
            $actorId,
            $resourceType,
            $resourceId,
            $action,
            $fromState,
            $toState,
            $notifyUserIds,
            $notificationType,
            $titleKey,
            $titleKey !== null ? $titleKey . 'Body' : null,
            $params
        );
    }

    private function seedAccounts(): void
    {
        foreach (self::ACCOUNTS as $key => $account) {
            $user = CodeMartV1UserModel::query()->firstOrNew(['username' => $account['username']]);
            $user->fill([
                'email' => $account['username'] . '@' . self::DEMO_EMAIL_DOMAIN,
                'name' => $account['name'],
                'rolename' => $account['rolename'],
                'rolelevel' => $account['rolelevel'] ?? 0,
            ]);
            if (!$user->exists || !Hash::check(self::DEMO_PASSWORD, (string) $user->password)) {
                $user->password = Hash::make(self::DEMO_PASSWORD);
            }
            $user->save();
            $this->users[$key] = (int) $user->id;
        }
        $this->log('Accounts: ' . count($this->users));
    }

    private function seedProfiles(): void
    {
        foreach (self::CLIENT_PROFILES as $key => $profile) {
            CodeMartV1ClientProfileModel::query()->updateOrCreate(
                ['user_id' => $this->users[$key]],
                $profile + ['profile_completed_at' => now()]
            );
        }

        foreach (self::DEVELOPER_PROFILES as $key => $profile) {
            CodeMartV1DeveloperProfileModel::query()->updateOrCreate(
                ['user_id' => $this->users[$key]],
                $profile + ['profile_completed_at' => now()]
            );
        }
    }

    /**
     * Developer/architect roles are requested pending and activated by the
     * administrator confirming their deposits (the real confirmation path);
     * the newcomer keeps a pending role with one rejected and one pending
     * deposit. Active roles are then enforced for repeat runs.
     */
    private function seedRolesAndDeposits(): void
    {
        $roleRequests = new CodeMartV1RoleRequestService();

        foreach (['developer', 'architect', 'newdev'] as $key) {
            if (!CodeMartV1UserRoleModel::forUserAndType($this->users[$key], CodeMartV1Constants::ROLE_DEVELOPER)) {
                $this->warnOnFailure('role request', $roleRequests->request($this->users[$key], CodeMartV1Constants::ROLE_DEVELOPER));
            }
        }
        if (!CodeMartV1UserRoleModel::forUserAndType($this->users['architect'], CodeMartV1Constants::ROLE_ARCHITECT)) {
            CodeMartV1UserRoleModel::createRecord([
                'user_id' => $this->users['architect'],
                'role_type' => CodeMartV1Constants::ROLE_ARCHITECT,
                'role_status' => CodeMartV1Constants::ROLE_STATUS_PENDING,
            ]);
        }

        foreach (self::DEPOSITS as $definition) {
            $this->seedDeposit($definition);
        }

        foreach (self::ACTIVE_ROLES as $key => $roleTypes) {
            foreach ($roleTypes as $roleType) {
                $role = CodeMartV1UserRoleModel::query()->firstOrNew(['user_id' => $this->users[$key], 'role_type' => $roleType]);
                if ($role->exists && $role->role_status === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
                    continue;
                }
                $role->fill([
                    'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                    'deposit_amount' => CodeMartV1Constants::getDepositAmount($roleType),
                    'role_activated_at' => $role->role_activated_at ?? now(),
                ]);
                $role->save();
            }
        }
    }

    private function seedDeposit(array $definition): void
    {
        $userId = $this->users[$definition['user']];
        $key = str_replace('{user}', (string) $userId, $definition['key']);
        $deposit = CodeMartV1DepositModel::findByIdempotencyKey($userId, $key);

        if (!$deposit) {
            $deposit = CodeMartV1DepositModel::createRecord([
                'user_id' => $userId,
                'role_type' => $definition['role'],
                'amount' => $definition['amount'],
                'payment_method' => $definition['method'],
                'status' => CodeMartV1Constants::DEPOSIT_STATUS_PENDING,
                'idempotency_key' => $key,
            ]);
            if ($definition['method'] === CodeMartV1Constants::PAYMENT_METHOD_BANK_TRANSFER) {
                $deposit->update(['payment_url' => '/api/codemart/v1/deposits/' . $deposit->id . '/bank-info']);
            }
        }

        if ($deposit->status === CodeMartV1Constants::DEPOSIT_STATUS_PENDING) {
            if ($definition['target'] === CodeMartV1Constants::DEPOSIT_STATUS_PAID) {
                $this->warnOnFailure('deposit confirm', $this->adminService->confirmDeposit((int) $deposit->id, $this->adminId()));
            } elseif ($definition['target'] === CodeMartV1Constants::DEPOSIT_STATUS_REJECTED) {
                $this->adminFinanceService->rejectDeposit((int) $deposit->id, $this->adminId(), $definition['notes']);
            }
            $deposit->refresh();
        }

        if ($deposit->status === CodeMartV1Constants::DEPOSIT_STATUS_PAID && $deposit->admin_id === null) {
            $deposit->update(['admin_id' => $this->adminId(), 'reviewed_at' => $deposit->paid_at ?? now()]);
        }
    }

    private function seedKyc(): void
    {
        foreach (self::KYC_RECORDS as $definition) {
            $kyc = CodeMartV1KycVerificationModel::query()->firstOrCreate(
                ['identity_number' => $definition['identity_number']],
                [
                    'user_id' => $this->users[$definition['user']],
                    'identity_type' => $definition['identity_type'],
                    'real_name' => $definition['real_name'],
                    'date_of_birth' => $definition['date_of_birth'],
                    'verification_status' => CodeMartV1Constants::KYC_STATUS_PENDING,
                ]
            );

            if ($definition['target'] === CodeMartV1Constants::KYC_STATUS_APPROVED
                && $kyc->verification_status === CodeMartV1Constants::KYC_STATUS_PENDING) {
                $this->warnOnFailure('kyc review', $this->adminService->reviewKyc((int) $kyc->id, true, null, $this->adminId()));
            }
        }
    }

    private function seedReviewerApplications(): void
    {
        foreach (self::REVIEWER_APPLICATIONS as $definition) {
            $userId = $this->users[$definition['user']];
            $passed = $definition['status'] === CodeMartV1Constants::REVIEWER_APPLICATION_PASSED;
            $application = CodeMartV1ReviewerApplicationModel::query()
                ->where('user_id', $userId)
                ->where('status', $definition['status'])
                ->first()
                ?? $this->createReviewerApplication($userId, $definition, $passed);

            $this->emitOnce(
                null,
                CodeMartV1Constants::RESOURCE_REVIEWER_APPLICATION,
                (int) $application->id,
                'test_graded',
                CodeMartV1Constants::REVIEWER_APPLICATION_IN_PROGRESS,
                $definition['status'],
                $passed ? [$userId] : [],
                $passed ? CodeMartV1Constants::NOTIFICATION_TYPE_ONBOARDING : null,
                $passed ? 'notifications.roleStatusChanged' : null,
                ['role' => CodeMartV1Constants::ROLE_REVIEWER, 'status' => $passed ? CodeMartV1Constants::ROLE_STATUS_ACTIVE : null, 'similarity_score' => $definition['similarity']]
            );
        }
    }

    private function createReviewerApplication(int $userId, array $definition, bool $passed): CodeMartV1ReviewerApplicationModel
    {
        $reviews = array_map(static fn (array $case): array => [
            'code_snippet_id' => $case['id'],
            'quality_rating' => $passed ? $case['expected_quality'] : 3,
            'readability_rating' => $passed ? $case['expected_readability'] : 3,
            'efficiency_rating' => $passed ? $case['expected_efficiency'] : 3,
            'comments' => 'Assessment of snippet ' . $case['id'] . ' covering structure, naming and complexity.',
        ], self::REVIEWER_TEST_CASES);

        return CodeMartV1ReviewerApplicationModel::createRecord([
            'user_id' => $userId,
            'status' => $definition['status'],
            'test_cases' => json_encode(self::REVIEWER_TEST_CASES),
            'user_reviews' => json_encode($reviews),
            'similarity_score' => $definition['similarity'],
            'completed_at' => now(),
        ]);
    }

    /**
     * Initial funding is a ledger credit keyed by seed_key metadata, applied
     * once. A wallet created by an older seed without any ledger row first
     * receives an opening-balance entry so the ledger explains the balance.
     */
    private function seedWallets(): void
    {
        foreach (array_keys(self::ACCOUNTS) as $key) {
            CodeMartV1WalletModel::forUser($this->users[$key], true);
        }

        foreach (self::WALLET_TOP_UPS as $key => $amount) {
            $seedKey = self::SEED_KEY_PREFIX . 'wallet-top-up-' . $key;
            CodeMartV1WalletModel::runInTransaction(function () use ($key, $amount, $seedKey): void {
                $wallet = CodeMartV1WalletModel::lockForUser($this->users[$key]);
                $ledger = CodeMartV1WalletTransactionModel::query()->where('wallet_id', $wallet->id);
                if ((clone $ledger)->where('metadata->seed_key', $seedKey)->exists()) {
                    return;
                }
                if (!(clone $ledger)->exists() && bccomp((string) $wallet->balance, '0', 2) > 0) {
                    CodeMartV1WalletTransactionModel::create([
                        'wallet_id' => $wallet->id,
                        'type' => CodeMartV1Constants::WALLET_TX_DEPOSIT,
                        'amount' => (string) $wallet->balance,
                        'balance_after' => (string) $wallet->balance,
                        'description' => 'Opening balance',
                        'metadata' => ['seed_key' => self::SEED_KEY_PREFIX . 'wallet-opening-' . $key, 'direction' => 'in'],
                        'status' => CodeMartV1Constants::WALLET_TX_STATUS_SUCCESS,
                    ]);
                }
                $wallet->credit($amount, CodeMartV1Constants::WALLET_TX_DEPOSIT, 'Wallet top-up', ['seed_key' => $seedKey, 'kind' => 'top_up']);
            });
        }
    }

    private function seedProject(array $definition): void
    {
        $clientId = $this->users[$definition['client']];
        $startDate = now()->addDays($definition['start_days'])->toDateString();
        $project = CodeMartV1ProjectModel::query()->firstOrNew(['client_id' => $clientId, 'title' => $definition['title']]);
        $isNew = !$project->exists;

        $project->fill([
            'description' => $definition['description'],
            'complexity' => $definition['complexity'],
            'budget' => $definition['budget'],
            'budget_type' => CodeMartV1Constants::BUDGET_TYPE_FIXED,
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'skills' => $definition['skills'],
            'languages' => $definition['languages'],
            'frameworks' => $definition['frameworks'],
            'databases' => $definition['databases'],
            'start_date' => $startDate,
            'end_date' => now()->addDays($definition['start_days'] + $definition['duration_days'])->toDateString(),
        ]);
        if ($isNew) {
            $project->status = CodeMartV1Constants::PROJECT_STATUS_DRAFT;
        }
        if (isset($definition['architect'])) {
            $project->architect_id = $this->users[$definition['architect']];
        }
        $project->save();
        $this->projects[$definition['key']] = $project;

        if ($isNew) {
            $this->emitOnce($clientId, CodeMartV1Constants::RESOURCE_PROJECT, (int) $project->id, 'created', null, CodeMartV1Constants::PROJECT_STATUS_DRAFT, [], null, null, ['project_title' => $definition['title']]);
        }

        if (isset($definition['attachment'])) {
            $this->seedAttachment($project, $clientId, $definition['attachment']);
        }
        if (isset($definition['analysis'])) {
            $this->seedAnalysis($project, $definition);
        }

        $this->advanceProject($project, $definition['target'], $clientId);

        $order = 0;
        foreach ($definition['milestones'] ?? [] as $milestoneDefinition) {
            $order++;
            $this->seedMilestone($project, $milestoneDefinition, $order);
        }

        $milestones = CodeMartV1MilestoneModel::query()->where('project_id', $project->id)->get();
        $project->total_milestones = $milestones->count();
        $project->completed_milestones = $milestones->where('status', CodeMartV1Constants::MILESTONE_STATUS_COMPLETED)->count();
        $project->save();
    }

    private function seedAttachment(CodeMartV1ProjectModel $project, int $clientId, array $attachment): void
    {
        $path = CodeMartV1Constants::PROJECT_ATTACHMENT_DIR . '/' . $project->id . '/' . $attachment['name'];
        $disk = Storage::disk(CodeMartV1Constants::DELIVERY_PRIVATE_DISK);
        if (!$disk->exists($path)) {
            $disk->put($path, $attachment['content']);
        }

        CodeMartV1ProjectAttachmentModel::query()->updateOrCreate(
            ['project_id' => $project->id, 'path' => $path],
            [
                'file_name' => $attachment['name'],
                'original_name' => $attachment['name'],
                'mime_type' => 'text/plain',
                'size' => strlen($attachment['content']),
                'uploaded_by' => $clientId,
            ]
        );
    }

    /**
     * Completed AI analysis mirrored into the single proposal row; accepted
     * (approved proposal) for every project past proposal review.
     */
    private function seedAnalysis(CodeMartV1ProjectModel $project, array $definition): void
    {
        $spec = $definition['analysis'];
        $accepted = !in_array($definition['target'], [
            CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW,
            CodeMartV1Constants::PROJECT_STATUS_CANCELLED,
        ], true);
        $idempotencyKey = self::SEED_KEY_PREFIX . 'analysis-' . $project->id;

        $analysis = CodeMartV1AIAnalysisModel::query()->where('project_id', $project->id)->where('idempotency_key', $idempotencyKey)->first()
            ?? new CodeMartV1AIAnalysisModel();
        $analysis->forceFill([
            'project_id' => $project->id,
            'status' => CodeMartV1Constants::AI_ANALYSIS_COMPLETED,
            'keywords' => json_encode($spec['keywords']),
            'recommended_languages' => json_encode($spec['languages']),
            'recommended_frameworks' => json_encode($spec['frameworks']),
            'recommended_databases' => json_encode($spec['databases']),
            'team_composition' => json_encode($spec['team']),
            'estimated_hours' => $spec['hours'],
            'estimated_cost' => $spec['cost'],
            'complexity_score' => $spec['complexity_score'],
            'proposal' => 'Based on analysis, this project involves: ' . implode(', ', $spec['keywords']) . '. '
                . 'We recommend a team of ' . implode(' + ', $spec['team']) . '. '
                . 'Estimated completion time: ' . $spec['hours'] . ' hours. '
                . 'Estimated cost: ' . CodeMartV1FinanceService::money($spec['cost']) . ' ' . CodeMartV1Constants::DEFAULT_CURRENCY . '.',
            'revision' => 1,
            'idempotency_key' => $idempotencyKey,
            'completed_at' => $analysis->completed_at ?? now(),
            'accepted_at' => $accepted ? ($analysis->accepted_at ?? now()) : null,
        ]);
        $analysis->save();

        CodeMartV1ProjectProposalModel::syncFromAnalysis(
            $analysis,
            $accepted ? CodeMartV1Constants::PROPOSAL_STATUS_APPROVED : CodeMartV1Constants::PROPOSAL_STATUS_PENDING
        );
        $project->analysis_status = $accepted ? CodeMartV1Constants::PROJECT_ANALYSIS_ACCEPTED : CodeMartV1Constants::PROJECT_ANALYSIS_COMPLETED;
        $project->save();

        $this->emitOnce(
            null,
            CodeMartV1Constants::RESOURCE_ANALYSIS,
            (int) $analysis->id,
            'completed',
            CodeMartV1Constants::AI_ANALYSIS_PROCESSING,
            CodeMartV1Constants::AI_ANALYSIS_COMPLETED,
            [(int) $project->client_id],
            CodeMartV1Constants::NOTIFICATION_TYPE_ANALYSIS,
            CodeMartV1Constants::NOTIFY_ANALYSIS_COMPLETED,
            ['project_id' => (int) $project->id, 'project_title' => (string) $project->title, 'analysis_id' => (int) $analysis->id]
        );
    }

    private function fundingKey(CodeMartV1ProjectModel $project): string
    {
        return self::SEED_KEY_PREFIX . 'fund-project-' . $project->id;
    }

    /**
     * Walks the lifecycle path toward the target status. Funding goes through
     * the escrow service (client wallet debit + held escrow) exactly once.
     */
    private function advanceProject(CodeMartV1ProjectModel $project, string $target, int $clientId): void
    {
        $path = self::PROJECT_STATUS_PATHS[$target];
        $needsEscrow = in_array(self::PATH_FUNDING, $path, true);
        $escrow = $needsEscrow ? CodeMartV1EscrowModel::findByIdempotencyKey($clientId, $this->fundingKey($project)) : null;

        if ($project->status === $target && ($escrow || !$needsEscrow)) {
            return;
        }

        $position = array_search($project->status, $path, true);
        if ($position === false && $project->status === CodeMartV1Constants::PROJECT_STATUS_OPEN) {
            $position = array_search(self::PATH_FUNDING, $path, true);
        }
        $start = $position === false ? 0 : $position + 1;
        if ($needsEscrow && !$escrow) {
            $fundingIndex = (int) array_search(CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, $path, true);
            $start = $project->status === $target ? $fundingIndex : min($start, $fundingIndex);
        }

        $count = count($path);
        for ($index = (int) $start; $index < $count; $index++) {
            $step = $path[$index];
            if ($step !== self::PATH_FUNDING) {
                $this->applyProjectStatus($project, $step, in_array($step, self::PROJECT_OWNER_STATUSES, true) ? $clientId : null);
                continue;
            }

            if ($escrow) {
                $this->applyProjectStatus($project, CodeMartV1Constants::PROJECT_STATUS_OPEN, null);
                continue;
            }

            $this->applyProjectStatus($project, CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING, $clientId);
            try {
                $escrow = CodeMartV1EscrowService::fundProject((int) $project->id, $clientId, $this->fundingKey($project))['escrow'];
            } catch (CodeMartV1FinanceException $e) {
                $this->log("Warning: funding project {$project->id} failed: {$e->errorCode}");
                return;
            }
            $project->refresh();
            if ($project->published_at === null) {
                $project->published_at = now();
                $project->save();
            }
        }
    }

    private function applyProjectStatus(CodeMartV1ProjectModel $project, string $toStatus, ?int $actorId): void
    {
        if ($project->status === $toStatus) {
            return;
        }

        $fromStatus = $project->status;
        $project->status = $toStatus;
        $project->state_revision = (int) $project->state_revision + 1;
        if ($project->published_at === null && in_array($toStatus, CodeMartV1Constants::PROJECT_MARKETPLACE_STATUSES, true)) {
            $project->published_at = now();
        }
        $project->save();

        $action = match ($toStatus) {
            CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW => CodeMartV1ProjectStateService::ACTION_ANALYSIS_COMPLETED,
            CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING => CodeMartV1ProjectStateService::ACTION_PROPOSAL_ACCEPTED,
            CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS => CodeMartV1ProjectStateService::ACTION_FIRST_TASK_ACCEPTED,
            default => CodeMartV1ProjectStateService::ACTION_STATUS_CHANGED,
        };

        CodeMartV1DomainEventService::emit(
            $actorId,
            CodeMartV1Constants::RESOURCE_PROJECT,
            (int) $project->id,
            $action,
            $fromStatus,
            $toStatus,
            $project->managerIds(),
            CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
            CodeMartV1Constants::NOTIFY_PROJECT_STATUS_CHANGED,
            CodeMartV1Constants::NOTIFY_PROJECT_STATUS_CHANGED_BODY,
            ['project_id' => (int) $project->id, 'project_title' => (string) $project->title, 'from_state' => $fromStatus, 'to_state' => $toStatus]
        );
    }

    private function seedMilestone(CodeMartV1ProjectModel $project, array $definition, int $order): void
    {
        $completed = $definition['status'] === CodeMartV1Constants::MILESTONE_STATUS_COMPLETED;
        $milestone = CodeMartV1MilestoneModel::query()->firstOrNew(['project_id' => $project->id, 'title' => $definition['title']]);
        $milestone->fill([
            'description' => $definition['description'],
            'status' => $definition['status'],
            'order' => $order,
            'budget' => $definition['budget'],
            'due_date' => $milestone->due_date ?? now()->addDays($definition['due_days'])->toDateString(),
            'deliverables' => $definition['deliverables'],
            'completed_at' => $completed ? ($milestone->completed_at ?? now()) : null,
        ]);
        $milestone->save();

        if ($completed) {
            $this->emitOnce(
                (int) $project->client_id,
                CodeMartV1Constants::RESOURCE_MILESTONE,
                (int) $milestone->id,
                'completed',
                CodeMartV1Constants::MILESTONE_STATUS_IN_PROGRESS,
                CodeMartV1Constants::MILESTONE_STATUS_COMPLETED,
                CodeMartV1TaskModel::assigneeIdsForProject((int) $project->id),
                CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
                CodeMartV1Constants::NOTIFY_MILESTONE_COMPLETED,
                ['project_id' => (int) $project->id, 'milestone_id' => (int) $milestone->id, 'milestone_title' => (string) $milestone->title]
            );
        }

        $taskOrder = 0;
        foreach ($definition['tasks'] as $taskDefinition) {
            $taskOrder++;
            $this->seedTask($project, $milestone, $taskDefinition, $taskOrder);
        }
    }

    private function seedTask(CodeMartV1ProjectModel $project, CodeMartV1MilestoneModel $milestone, array $definition, int $order): void
    {
        $assigneeId = isset($definition['assignee']) ? $this->users[$definition['assignee']] : null;
        $status = $definition['status'];
        $task = CodeMartV1TaskModel::query()->firstOrNew(['milestone_id' => $milestone->id, 'title' => $definition['title']]);
        $isNew = !$task->exists;
        $statusChanged = $task->status !== $status;

        $task->fill([
            'description' => $definition['description'],
            'status' => $status,
            'priority' => $definition['priority'],
            'assigned_to' => $assigneeId,
            'budget_allocation' => $definition['budget'],
            'due_date' => $task->due_date ?? now()->addDays($definition['due_days']),
            'order' => $order,
            'required_skills' => $definition['skills'],
            'deliverables' => $definition['deliverables'] ?? [$definition['title']],
            'assigned_at' => $assigneeId !== null ? ($task->assigned_at ?? now()) : null,
            'started_at' => in_array($status, self::TASK_STARTED_STATUSES, true) ? ($task->started_at ?? now()) : null,
            'completed_at' => $status === CodeMartV1Constants::TASK_STATUS_COMPLETED ? ($task->completed_at ?? now()) : null,
        ]);
        if ($statusChanged && !$isNew) {
            $task->state_revision = (int) $task->state_revision + 1;
        }
        $task->save();

        $managerIds = $project->managerIds();
        $taskParams = ['task_id' => (int) $task->id, 'task_title' => (string) $task->title, 'project_id' => (int) $project->id];

        if ($assigneeId !== null) {
            $this->emitOnce(
                $assigneeId,
                CodeMartV1Constants::RESOURCE_TASK,
                (int) $task->id,
                CodeMartV1TaskStateService::ACTION_ACCEPTED,
                CodeMartV1Constants::TASK_STATUS_OPEN,
                CodeMartV1Constants::TASK_STATUS_ASSIGNED,
                $managerIds,
                CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
                CodeMartV1Constants::NOTIFY_TASK_ACCEPTED,
                $taskParams + ['developer_id' => $assigneeId]
            );
        }
        if ($status === CodeMartV1Constants::TASK_STATUS_BLOCKED) {
            $this->emitOnce(
                $assigneeId,
                CodeMartV1Constants::RESOURCE_TASK,
                (int) $task->id,
                CodeMartV1TaskStateService::ACTION_STATUS_CHANGED,
                CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
                CodeMartV1Constants::TASK_STATUS_BLOCKED,
                $managerIds,
                CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
                CodeMartV1Constants::NOTIFY_TASK_STATUS_CHANGED,
                $taskParams + ['from_state' => CodeMartV1Constants::TASK_STATUS_IN_PROGRESS, 'to_state' => CodeMartV1Constants::TASK_STATUS_BLOCKED]
            );
        }

        foreach ($definition['submissions'] ?? [] as $submissionDefinition) {
            $this->seedSubmission($project, $task, (int) $assigneeId, $submissionDefinition);
        }
        foreach ($definition['comments'] ?? [] as $commentDefinition) {
            $this->seedComment($project, $task, $commentDefinition);
        }

        if ($status === CodeMartV1Constants::TASK_STATUS_COMPLETED && $assigneeId !== null) {
            $release = CodeMartV1EscrowService::releaseForTask($task, (int) $project->client_id);
            if (!$release['released']) {
                $this->log("Warning: escrow release for task {$task->id} failed: {$release['error_code']}");
            }
        }
    }

    private function seedSubmission(CodeMartV1ProjectModel $project, CodeMartV1TaskModel $task, int $submitterId, array $definition): void
    {
        $clientReview = $definition['client_review'] ?? null;
        $submission = CodeMartV1TaskSubmissionModel::query()->firstOrNew([
            'task_id' => $task->id,
            'submitted_by' => $submitterId,
            'submission_note' => $definition['note'],
        ]);
        $submission->fill([
            'files' => $definition['files'],
            'status' => $definition['status'],
            'reviewed_by' => $clientReview !== null ? (int) $project->client_id : null,
            'reviewed_at' => $clientReview !== null ? ($submission->reviewed_at ?? now()) : null,
        ]);
        $submission->save();

        $params = ['task_id' => (int) $task->id, 'task_title' => (string) $task->title, 'project_id' => (int) $project->id, 'submission_id' => (int) $submission->id];

        $this->emitOnce(
            $submitterId,
            CodeMartV1Constants::RESOURCE_SUBMISSION,
            (int) $submission->id,
            'submission_created',
            null,
            CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
            $project->managerIds(),
            CodeMartV1Constants::NOTIFICATION_TYPE_REVIEW,
            CodeMartV1Constants::NOTIFY_SUBMISSION_CREATED,
            $params
        );

        if (isset($definition['reviewer_review'])) {
            $this->seedReviewerReview($project, $submission, $definition['reviewer_review'], $params);
        }

        if ($clientReview !== null) {
            $review = CodeMartV1CodeReviewModel::query()->firstOrNew([
                'task_submission_id' => $submission->id,
                'reviewer_id' => (int) $project->client_id,
                'review_kind' => CodeMartV1Constants::REVIEW_KIND_CLIENT,
            ]);
            $review->fill([
                'status' => $clientReview['status'],
                'review_notes' => $clientReview['notes'],
                'rating' => $clientReview['rating'],
            ]);
            $review->save();

            $this->emitOnce(
                (int) $project->client_id,
                CodeMartV1Constants::RESOURCE_SUBMISSION,
                (int) $submission->id,
                'submission_reviewed',
                CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
                $clientReview['status'],
                [$submitterId],
                CodeMartV1Constants::NOTIFICATION_TYPE_REVIEW,
                CodeMartV1Constants::NOTIFY_SUBMISSION_REVIEWED,
                $params + ['status' => $clientReview['status'], 'rating' => $clientReview['rating']]
            );
        }
    }

    private function seedReviewerReview(CodeMartV1ProjectModel $project, CodeMartV1TaskSubmissionModel $submission, array $definition, array $params): void
    {
        $reviewerId = $this->users['reviewer'];
        $ratings = [$definition['quality'], $definition['readability'], $definition['efficiency'], $definition['security']];
        $codeScore = CodeMartV1CodeReviewModel::codeScoreFromRatings($ratings);
        $recommendation = $definition['recommendation'] ?? CodeMartV1CodeReviewModel::derivedRecommendation($ratings);

        $review = CodeMartV1CodeReviewModel::query()->firstOrNew([
            'task_submission_id' => $submission->id,
            'reviewer_id' => $reviewerId,
            'review_kind' => CodeMartV1Constants::REVIEW_KIND_REVIEWER,
        ]);
        $review->fill([
            'status' => $recommendation,
            'recommendation' => $recommendation,
            'review_notes' => $definition['comments'],
            'comments' => $definition['comments'],
            'rating' => (int) round(array_sum($ratings) / count($ratings)),
            'quality_rating' => $definition['quality'],
            'readability_rating' => $definition['readability'],
            'efficiency_rating' => $definition['efficiency'],
            'security_rating' => $definition['security'],
            'code_score' => $codeScore,
        ]);
        $review->save();

        $this->emitOnce(
            $reviewerId,
            CodeMartV1Constants::RESOURCE_SUBMISSION,
            (int) $submission->id,
            'reviewer_review_recorded',
            null,
            null,
            $project->managerIds(),
            CodeMartV1Constants::NOTIFICATION_TYPE_REVIEW,
            CodeMartV1Constants::NOTIFY_REVIEWER_REVIEW_RECORDED,
            $params + ['review_id' => (int) $review->id, 'recommendation' => $recommendation, 'code_score' => $codeScore]
        );
    }

    private function seedComment(CodeMartV1ProjectModel $project, CodeMartV1TaskModel $task, array $definition): void
    {
        $userId = $this->users[$definition['user']];
        $comment = CodeMartV1TaskCommentModel::query()->firstOrCreate(
            ['task_id' => $task->id, 'user_id' => $userId, 'comment' => $definition['text']],
            ['mentions' => []]
        );

        $this->emitOnce(
            $userId,
            CodeMartV1Constants::RESOURCE_COMMENT,
            (int) $comment->id,
            'comment_added',
            null,
            null,
            array_merge($project->managerIds(), array_filter([(int) $task->assigned_to])),
            CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
            CodeMartV1Constants::NOTIFY_COMMENT_ADDED,
            ['task_id' => (int) $task->id, 'task_title' => (string) $task->title, 'project_id' => (int) $project->id, 'comment_id' => (int) $comment->id]
        );
    }

    /** Wallet-method payment: one payer debit and one payee credit, once per idempotency key. */
    private function seedWalletPayments(): void
    {
        foreach (self::WALLET_PAYMENTS as $definition) {
            $payerId = $this->users[$definition['payer']];
            $payeeId = $this->users[$definition['payee']];
            $projectId = (int) $this->projects[$definition['project']]->id;

            try {
                [$payment, $replayed] = CodeMartV1PaymentModel::runInTransaction(function () use ($definition, $payerId, $payeeId, $projectId): array {
                    $wallets = CodeMartV1WalletModel::lockForUsers([$payerId, $payeeId]);
                    $prior = CodeMartV1PaymentModel::findByIdempotencyKey($payerId, $definition['key']);
                    if ($prior) {
                        return [$prior, true];
                    }
                    $payment = CodeMartV1PaymentModel::createRecord([
                        'payer_id' => $payerId,
                        'payee_id' => $payeeId,
                        'project_id' => $projectId,
                        'amount' => $definition['amount'],
                        'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                        'type' => $definition['type'],
                        'payment_method' => CodeMartV1Constants::PAYMENT_METHOD_WALLET,
                        'description' => $definition['description'],
                        'status' => CodeMartV1Constants::PAYMENT_STATUS_COMPLETED,
                        'idempotency_key' => $definition['key'],
                    ]);
                    $meta = ['payment_id' => $payment->id];
                    if (!$wallets[$payerId]->debit($definition['amount'], CodeMartV1Constants::WALLET_TX_PAYMENT, "Payment {$payment->id} to user {$payeeId}", $meta)) {
                        throw new CodeMartV1FinanceException('insufficient_balance', 'Insufficient available wallet balance', 422);
                    }
                    $wallets[$payeeId]->credit($definition['amount'], CodeMartV1Constants::WALLET_TX_EARNING, "Payment {$payment->id} from user {$payerId}", $meta);

                    return [$payment, false];
                });
            } catch (CodeMartV1FinanceException $e) {
                $this->log("Warning: payment {$definition['key']} failed: {$e->errorCode}");
                continue;
            }

            if (!$replayed) {
                CodeMartV1DomainEventService::emit(
                    $payerId,
                    'payment',
                    (int) $payment->id,
                    'payment_created',
                    null,
                    $payment->status,
                    [$payeeId],
                    CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                    'notifications.paymentReceived',
                    'notifications.paymentReceivedBody',
                    ['amount' => (string) $payment->amount, 'payment_id' => (int) $payment->id]
                );
            }
            $this->payments[$definition['key']] = $payment;
        }
    }

    /** Payer refund request: payment moves to disputed with one open refund awaiting the administrator. */
    private function seedRefundRequests(): void
    {
        foreach (self::REFUND_REQUESTS as $definition) {
            $payment = $this->payments[$definition['payment']] ?? null;
            if (!$payment) {
                continue;
            }
            $payerId = (int) $payment->payer_id;

            [$refund, $replayed] = CodeMartV1FinanceService::idempotent(
                $payerId,
                $definition['key'],
                static fn (string $key) => CodeMartV1RefundModel::findByIdempotencyKey($payerId, $key),
                function () use ($definition, $payment, $payerId): ?CodeMartV1RefundModel {
                    $locked = CodeMartV1PaymentModel::lockById((int) $payment->id);
                    if (!$locked || CodeMartV1RefundModel::openForPayment((int) $locked->id)
                        || $locked->status !== CodeMartV1Constants::PAYMENT_STATUS_COMPLETED) {
                        return null;
                    }
                    $refund = CodeMartV1RefundModel::createRecord([
                        'payment_id' => $locked->id,
                        'amount' => $locked->amount,
                        'reason' => $definition['reason'],
                        'notes' => $definition['notes'],
                        'requested_at' => now(),
                        'requested_by' => $payerId,
                        'idempotency_key' => $definition['key'],
                        'status' => CodeMartV1Constants::REFUND_STATUS_PENDING,
                    ]);
                    $locked->update(['status' => CodeMartV1Constants::PAYMENT_STATUS_DISPUTED]);

                    return $refund;
                }
            );

            if ($refund && !$replayed) {
                CodeMartV1DomainEventService::emit(
                    $payerId,
                    'refund',
                    (int) $refund->id,
                    'refund_requested',
                    null,
                    CodeMartV1Constants::REFUND_STATUS_PENDING,
                    [(int) $payment->payee_id, $this->adminId()],
                    CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                    'notifications.refundRequested',
                    'notifications.refundRequestedBody',
                    ['amount' => (string) $refund->amount, 'payment_id' => (int) $payment->id, 'payment_from_state' => CodeMartV1Constants::PAYMENT_STATUS_COMPLETED]
                );
            }
        }
    }

    private function seedInvoices(): void
    {
        foreach (self::INVOICES as $definition) {
            if (isset($definition['payment'])) {
                $payment = $this->payments[$definition['payment']] ?? null;
            } else {
                [$projectKey, $taskTitle] = $definition['business_ref_task'];
                $taskId = CodeMartV1TaskModel::forProjectQuery((int) $this->projects[$projectKey]->id)->where('title', $taskTitle)->value('id');
                $payment = $taskId ? CodeMartV1PaymentModel::findByBusinessRef(CodeMartV1Constants::BUSINESS_REF_TASK_RELEASE . $taskId) : null;
            }
            if (!$payment) {
                continue;
            }

            $amount = CodeMartV1FinanceService::money($payment->amount);
            $invoice = CodeMartV1InvoiceModel::query()->firstOrNew(['invoice_number' => $definition['number']]);
            $invoice->fill([
                'payment_id' => $payment->id,
                'issued_by' => (int) $payment->payee_id,
                'description' => $definition['description'],
                'line_items' => [['description' => $definition['description'], 'quantity' => 1, 'unit_price' => $amount, 'amount' => $amount]],
                'subtotal' => $amount,
                'tax' => '0.00',
                'total' => $amount,
                'issued_date' => $invoice->issued_date ?? now()->toDateString(),
                'due_date' => $invoice->due_date ?? now()->addDays(14)->toDateString(),
                'status' => $definition['status'],
            ]);
            $invoice->save();
        }
    }

    /** Requested withdrawals freeze funds; approved stay frozen; paid settle the frozen amount. */
    private function seedWithdrawals(): void
    {
        foreach (self::WITHDRAWALS as $definition) {
            $userId = $this->users[$definition['user']];
            try {
                [$withdrawal, $replayed] = CodeMartV1FinanceService::idempotent(
                    $userId,
                    $definition['key'],
                    static fn (string $key) => CodeMartV1WithdrawalModel::findByIdempotencyKey($userId, $key),
                    static function () use ($definition, $userId): CodeMartV1WithdrawalModel {
                        $wallet = CodeMartV1WalletModel::lockForUser($userId);
                        $withdrawal = CodeMartV1WithdrawalModel::createRecord([
                            'user_id' => $userId,
                            'amount' => $definition['amount'],
                            'currency' => $wallet->currency ?: CodeMartV1Constants::DEFAULT_CURRENCY,
                            'status' => CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING,
                            'method' => $definition['method'],
                            'account_info' => $definition['account'],
                            'idempotency_key' => $definition['key'],
                        ]);
                        $ledger = $wallet->freeze(
                            $definition['amount'],
                            CodeMartV1Constants::WALLET_TX_WITHDRAWAL,
                            "Withdrawal {$withdrawal->id} requested",
                            ['withdrawal_id' => $withdrawal->id, 'phase' => 'freeze']
                        );
                        if (!$ledger) {
                            throw new CodeMartV1FinanceException('insufficient_balance', 'Insufficient available wallet balance', 422);
                        }

                        return $withdrawal;
                    }
                );

                if (!$replayed) {
                    CodeMartV1DomainEventService::emit($userId, 'withdrawal', (int) $withdrawal->id, 'withdrawal_requested', null, CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING, [], null, null, null, ['amount' => (string) $withdrawal->amount, 'method' => $withdrawal->method]);
                }

                $target = $definition['target'];
                if ($target !== CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING
                    && $withdrawal->status === CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING) {
                    $withdrawal = $this->adminFinanceService->approveWithdrawal((int) $withdrawal->id, $this->adminId(), $definition['notes']);
                }
                if ($target === CodeMartV1Constants::WITHDRAWAL_STATUS_PAID
                    && $withdrawal->status === CodeMartV1Constants::WITHDRAWAL_STATUS_APPROVED) {
                    $this->adminFinanceService->payWithdrawal((int) $withdrawal->id, $this->adminId(), $definition['notes']);
                }
            } catch (CodeMartV1FinanceException $e) {
                $this->log("Warning: withdrawal {$definition['key']} failed: {$e->errorCode}");
            }
        }
    }

    private function seedTestimonials(): void
    {
        foreach (self::TESTIMONIALS as $definition) {
            $testimonial = CodeMartV1TestimonialModel::query()->firstOrNew(['quote_key' => $definition['quote_key']]);
            $testimonial->fill([
                'quotes' => $definition['quotes'],
                'author_label' => $definition['author_label'],
                'role_label' => $definition['role_label'],
                'role_labels' => $definition['role_labels'],
                'avatar_url' => null,
                'approved' => true,
                'status' => CodeMartV1Constants::TESTIMONIAL_STATUS_APPROVED,
                'display_order' => $definition['display_order'],
                'user_id' => isset($definition['user']) ? $this->users[$definition['user']] : null,
                'project_id' => isset($definition['project']) ? (int) $this->projects[$definition['project']]->id : null,
                'moderated_by' => $testimonial->moderated_by ?? $this->adminId(),
                'moderated_at' => $testimonial->moderated_at ?? now(),
            ]);
            $testimonial->save();
        }

        $testimonialService = new CodeMartV1TestimonialService();
        foreach (self::PENDING_TESTIMONIALS as $definition) {
            $userId = $this->users[$definition['user']];
            $projectId = (int) $this->projects[$definition['project']]->id;
            $exists = CodeMartV1TestimonialModel::query()->where('user_id', $userId)->where('project_id', $projectId)->exists();
            if ($exists) {
                continue;
            }
            $this->warnOnFailure('testimonial submit', $testimonialService->submit($userId, [
                'quotes' => $definition['quotes'],
                'role_labels' => $definition['role_labels'],
                'author_label' => $definition['author_label'],
                'role_label' => $definition['role_label'],
                'project_id' => $projectId,
            ], self::DEMO_LOCALE));
        }
    }

    private function seedContactMessages(): void
    {
        foreach (self::CONTACT_MESSAGES as $definition) {
            $message = CodeMartV1ContactMessageModel::query()->firstOrCreate(
                ['email' => $definition['email'], 'subject' => $definition['subject']],
                [
                    'name' => $definition['name'],
                    'message' => $definition['message'],
                    'status' => CodeMartV1Constants::CONTACT_STATUS_NEW,
                ]
            );
            if ($definition['handled'] && $message->status !== CodeMartV1Constants::CONTACT_STATUS_HANDLED) {
                $this->adminService->handleContactMessage((int) $message->id, $this->adminId());
            }
        }
    }

    /**
     * Delivery statistics recomputed from the seeded ledger of record:
     * completed tasks, reviewer code scores, client ratings, released escrow
     * earnings and the number of closed projects the user delivered work on.
     */
    private function seedStats(): void
    {
        foreach (array_keys(self::DEVELOPER_PROFILES) as $key) {
            $userId = $this->users[$key];
            $stats = CodeMartV1DeveloperStatsModel::recalculateForUser($userId, 0.0);

            $earnings = CodeMartV1PaymentModel::query()
                ->where('payee_id', $userId)
                ->where('status', CodeMartV1Constants::PAYMENT_STATUS_COMPLETED)
                ->where('business_ref', 'like', CodeMartV1Constants::BUSINESS_REF_TASK_RELEASE . '%')
                ->sum('amount');
            $completedProjects = CodeMartV1TaskModel::query()
                ->with('milestone.project')
                ->where('assigned_to', $userId)
                ->where('status', CodeMartV1Constants::TASK_STATUS_COMPLETED)
                ->get()
                ->map(static fn (CodeMartV1TaskModel $task) => $task->milestone?->project)
                ->filter(static fn ($project): bool => $project !== null && in_array($project->status, [
                    CodeMartV1Constants::PROJECT_STATUS_COMPLETED,
                    CodeMartV1Constants::PROJECT_STATUS_ARCHIVED,
                ], true))
                ->unique('id')
                ->count();

            $stats->updateRecord([
                'total_earnings' => CodeMartV1FinanceService::money($earnings),
                'completed_projects' => $completedProjects,
            ]);
            CodeMartV1DeveloperProfileModel::query()->where('user_id', $userId)->update([
                'completed_projects' => $completedProjects,
                'average_rating' => (float) $stats->avg_client_satisfaction,
            ]);
        }

        foreach (array_keys(self::CLIENT_PROFILES) as $key) {
            CodeMartV1ClientProfileModel::query()->where('user_id', $this->users[$key])->update([
                'posted_projects' => CodeMartV1ProjectModel::query()->where('client_id', $this->users[$key])->count(),
            ]);
        }
    }

    private function markNotificationsRead(): void
    {
        CodeMartV1NotificationModel::query()
            ->whereIn('user_id', array_values($this->users))
            ->whereIn('title_key', self::READ_NOTIFICATION_KEYS)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    private function tableCounts(): array
    {
        $counts = ['demo_users' => count($this->users)];
        foreach (self::COUNTED_MODELS as $name => $modelClass) {
            $counts[$name] = $modelClass::query()->count();
        }

        return $counts;
    }
}
