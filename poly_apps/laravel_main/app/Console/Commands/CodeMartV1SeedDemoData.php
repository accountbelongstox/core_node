<?php

namespace App\Console\Commands;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ClientProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TestimonialModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CodeMartV1SeedDemoData extends Command
{
    protected $signature = 'sys:codemartinit';

    protected $description = 'Seed CodeMart demo accounts, projects, milestones, tasks, deposits, wallets and testimonials (idempotent)';

    private const DEMO_PASSWORD = 'Codemart#2026';

    public function handle(): int
    {
        $client = $this->seedUser('codemart_demo_client', 'codemart_demo_client@codemart.local', 'Demo Client', CodeMartV1Constants::ROLE_CLIENT);
        $developer = $this->seedUser('codemart_demo_developer', 'codemart_demo_developer@codemart.local', 'Demo Developer', CodeMartV1Constants::ROLE_DEVELOPER);
        $architect = $this->seedUser('codemart_demo_architect', 'codemart_demo_architect@codemart.local', 'Demo Architect', CodeMartV1Constants::ROLE_ARCHITECT);
        $reviewer = $this->seedUser('codemart_demo_reviewer', 'codemart_demo_reviewer@codemart.local', 'Demo Reviewer', CodeMartV1Constants::ROLE_REVIEWER);

        $this->seedProfiles($client->id, $developer->id, $architect->id);
        $this->seedDeveloperStats($developer->id, $architect->id);
        $this->seedWallets($client->id, $developer->id, $architect->id);
        $this->seedDeposits($developer->id, $architect->id);
        $this->seedProjects($client->id, $developer->id, $architect->id);
        $this->seedTestimonials();

        $this->info('CodeMart demo data initialized.');
        $this->line('Demo accounts (password: ' . self::DEMO_PASSWORD . '):');
        $this->line('  codemart_demo_client / codemart_demo_developer / codemart_demo_architect / codemart_demo_reviewer');

        return self::SUCCESS;
    }

    private function seedUser(string $username, string $email, string $realName, string $roleType): CodeMartV1UserModel
    {
        $user = CodeMartV1UserModel::query()->updateOrCreate(
            ['username' => $username],
            [
                'email' => $email,
                'password' => Hash::make(self::DEMO_PASSWORD),
                'name' => $realName,
                'rolename' => $roleType,
                'rolelevel' => 0,
            ]
        );

        CodeMartV1UserRoleModel::query()->updateOrCreate(
            ['user_id' => $user->id, 'role_type' => $roleType],
            [
                'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                'deposit_amount' => CodeMartV1Constants::getDepositAmount($roleType),
                'role_activated_at' => now(),
            ]
        );

        if ($roleType === CodeMartV1Constants::ROLE_ARCHITECT) {
            // An architect keeps the developer role active; the dedicated
            // architect role row above carries the architect state that the
            // bootstrap capability map and CodeMartV1ArchitectCtl read.
            CodeMartV1UserRoleModel::query()->updateOrCreate(
                ['user_id' => $user->id, 'role_type' => CodeMartV1Constants::ROLE_DEVELOPER],
                [
                    'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                    'deposit_amount' => CodeMartV1Constants::DEPOSIT_DEVELOPER,
                    'role_activated_at' => now(),
                ]
            );
        }

        return $user;
    }

    private function seedDeveloperStats(int $developerId, int $architectId): void
    {
        CodeMartV1DeveloperStatsModel::query()->updateOrCreate(
            ['user_id' => $developerId],
            [
                'completed_projects' => 6,
                'avg_code_score' => 82.50,
                'avg_client_satisfaction' => 4.30,
                'total_earnings' => 24800.00,
                'on_time_delivery_rate' => 0.92,
            ]
        );

        CodeMartV1DeveloperStatsModel::query()->updateOrCreate(
            ['user_id' => $architectId],
            [
                'completed_projects' => 14,
                'avg_code_score' => 91.00,
                'avg_client_satisfaction' => 4.80,
                'total_earnings' => 86500.00,
                'on_time_delivery_rate' => 0.97,
            ]
        );
    }

    private function seedProfiles(int $clientId, int $developerId, int $architectId): void
    {
        CodeMartV1ClientProfileModel::query()->updateOrCreate(
            ['user_id' => $clientId],
            [
                'company_name' => 'Northwind Retail Group',
                'industry' => 'Retail',
                'company_description' => 'Regional retail chain modernizing its supply chain and customer-facing tooling.',
                'contact_person' => 'Demo Client',
                'posted_projects' => 5,
                'average_rating' => 4.6,
                'profile_completed_at' => now(),
            ]
        );

        foreach ([$developerId, $architectId] as $userId) {
            CodeMartV1DeveloperProfileModel::query()->updateOrCreate(
                ['user_id' => $userId],
                [
                    'company_name' => 'Independent',
                    'bio' => 'Full-stack engineer focused on Laravel, React and PostgreSQL delivery.',
                    'skills' => json_encode(['PHP', 'Laravel', 'React', 'TypeScript', 'PostgreSQL']),
                    'completed_projects' => 12,
                    'average_rating' => 4.8,
                    'profile_completed_at' => now(),
                ]
            );
        }
    }

    private function seedWallets(int $clientId, int $developerId, int $architectId): void
    {
        $balances = [
            $clientId => '50000.00',
            $developerId => '8600.00',
            $architectId => '15200.00',
        ];

        foreach ($balances as $userId => $balance) {
            CodeMartV1WalletModel::query()->updateOrCreate(
                ['user_id' => $userId],
                [
                    'balance' => $balance,
                    'available_balance' => $balance,
                    'frozen_balance' => '0.00',
                    'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                ]
            );
        }
    }

    private function seedDeposits(int $developerId, int $architectId): void
    {
        CodeMartV1DepositModel::query()->updateOrCreate(
            ['idempotency_key' => 'seed-developer-deposit-' . $developerId],
            [
                'user_id' => $developerId,
                'role_type' => CodeMartV1Constants::ROLE_DEVELOPER,
                'amount' => CodeMartV1Constants::DEPOSIT_DEVELOPER,
                'payment_method' => CodeMartV1Constants::PAYMENT_METHOD_ALIPAY,
                'status' => 'paid',
                'paid_at' => now(),
            ]
        );

        foreach ([CodeMartV1Constants::ROLE_DEVELOPER, CodeMartV1Constants::ROLE_ARCHITECT] as $roleType) {
            CodeMartV1DepositModel::query()->updateOrCreate(
                ['idempotency_key' => 'seed-architect-deposit-' . $roleType . '-' . $architectId],
                [
                    'user_id' => $architectId,
                    'role_type' => $roleType,
                    'amount' => $roleType === CodeMartV1Constants::ROLE_ARCHITECT
                        ? CodeMartV1Constants::DEPOSIT_ARCHITECT_ADDITIONAL
                        : CodeMartV1Constants::DEPOSIT_DEVELOPER,
                    'payment_method' => CodeMartV1Constants::PAYMENT_METHOD_BANK_TRANSFER,
                    'status' => 'paid',
                    'paid_at' => now(),
                ]
            );
        }
    }

    private function seedProjects(int $clientId, int $developerId, int $architectId): void
    {
        $inventory = $this->seedProject($clientId, [
            'title' => 'Smart Inventory Management Platform',
            'description' => 'Barcode-driven stock tracking with movement auditing, warehouse dashboards and exportable reports for a regional retail chain.',
            'status' => CodeMartV1Constants::PROJECT_STATUS_OPEN,
            'complexity' => CodeMartV1Constants::COMPLEXITY_COMPLEX,
            'budget' => 46000,
            'skills' => ['PHP', 'Laravel', 'React', 'PostgreSQL'],
        ]);
        $inventoryBackend = $this->seedMilestone($inventory->id, 'Backend foundation', 'Inventory schema, stock movement API and barcode endpoints.', CodeMartV1Constants::MILESTONE_STATUS_IN_PROGRESS, 1, 21000, 45);
        $inventoryFrontend = $this->seedMilestone($inventory->id, 'Frontend dashboards', 'Warehouse overview dashboard and reporting UI.', CodeMartV1Constants::MILESTONE_STATUS_PENDING, 2, 25000, 75);
        $this->seedTask($inventoryBackend->id, 'Design inventory schema', 'Normalized schema for warehouses, items, stock levels and movement audit trails.', CodeMartV1Constants::TASK_STATUS_COMPLETED, CodeMartV1Constants::TASK_PRIORITY_HIGH, $developerId, 3000, 10, ['PostgreSQL']);
        $this->seedTask($inventoryBackend->id, 'Implement stock movement API', 'Transactional in/out/transfer endpoints with idempotency and audit logging.', CodeMartV1Constants::TASK_STATUS_IN_PROGRESS, CodeMartV1Constants::TASK_PRIORITY_URGENT, $developerId, 8000, 25, ['PHP', 'Laravel']);
        $this->seedTask($inventoryBackend->id, 'Build barcode scanning endpoint', 'Scan-to-movement endpoint with batch support and offline conflict resolution.', CodeMartV1Constants::TASK_STATUS_OPEN, CodeMartV1Constants::TASK_PRIORITY_MEDIUM, null, 10000, 40, ['PHP', 'Laravel']);
        $this->seedTask($inventoryFrontend->id, 'Inventory overview dashboard', 'Real-time stock dashboard with warehouse filters and low-stock alerts.', CodeMartV1Constants::TASK_STATUS_OPEN, CodeMartV1Constants::TASK_PRIORITY_MEDIUM, null, 14000, 60, ['React', 'TypeScript']);
        $this->seedTask($inventoryFrontend->id, 'Reports and export UI', 'Report builder with CSV/XLSX export for movements and stock levels.', CodeMartV1Constants::TASK_STATUS_OPEN, CodeMartV1Constants::TASK_PRIORITY_LOW, null, 11000, 70, ['React']);
        $this->syncProjectMilestoneCounts($inventory);

        $fitness = $this->seedProject($clientId, [
            'title' => 'Mobile Fitness Tracking Application',
            'description' => 'Cross-platform fitness app with workout plans, progress charts and wearable sync, delivered through the managed architect flow.',
            'status' => CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS,
            'complexity' => CodeMartV1Constants::COMPLEXITY_MEDIUM,
            'budget' => 32000,
            'skills' => ['Flutter', 'Dart', 'Laravel'],
        ], $architectId);
        $fitnessMvp = $this->seedMilestone($fitness->id, 'MVP release', 'Core tracking, plans and charting for the first store release.', CodeMartV1Constants::MILESTONE_STATUS_IN_PROGRESS, 1, 32000, 30);
        $this->seedTask($fitnessMvp->id, 'Workout plan engine', 'Plan templates, scheduling and progression rules exposed via API.', CodeMartV1Constants::TASK_STATUS_IN_PROGRESS, CodeMartV1Constants::TASK_PRIORITY_HIGH, $developerId, 12000, 20, ['Laravel']);
        $this->seedTask($fitnessMvp->id, 'Progress charts', 'Weekly and monthly progress visualizations with trend lines.', CodeMartV1Constants::TASK_STATUS_OPEN, CodeMartV1Constants::TASK_PRIORITY_MEDIUM, null, 9000, 35, ['Flutter']);
        $this->syncProjectMilestoneCounts($fitness);

        $website = $this->seedProject($clientId, [
            'title' => 'Corporate Website Redesign',
            'description' => 'Responsive marketing site refresh with localized content and analytics instrumentation.',
            'status' => CodeMartV1Constants::PROJECT_STATUS_COMPLETED,
            'complexity' => CodeMartV1Constants::COMPLEXITY_SIMPLE,
            'budget' => 12000,
            'skills' => ['React', 'TypeScript'],
        ]);
        $websiteLaunch = $this->seedMilestone($website->id, 'Launch', 'Full redesign delivered and deployed.', CodeMartV1Constants::MILESTONE_STATUS_COMPLETED, 1, 12000, 7);
        $this->seedTask($websiteLaunch->id, 'Responsive page rebuild', 'Rebuild all public pages with the unified shell and mobile adaptation.', CodeMartV1Constants::TASK_STATUS_COMPLETED, CodeMartV1Constants::TASK_PRIORITY_MEDIUM, $developerId, 8000, 5, ['React']);
        $this->seedTask($websiteLaunch->id, 'Analytics instrumentation', 'Privacy-aware event tracking for the marketing funnel.', CodeMartV1Constants::TASK_STATUS_COMPLETED, CodeMartV1Constants::TASK_PRIORITY_LOW, $developerId, 4000, 6, ['TypeScript']);
        $this->syncProjectMilestoneCounts($website);

        $this->seedProject($clientId, [
            'title' => 'AI Customer Support Chatbot',
            'description' => 'Support chatbot trained on the help-center corpus with human handoff and satisfaction tracking. Awaiting AI requirement analysis.',
            'status' => CodeMartV1Constants::PROJECT_STATUS_DRAFT,
            'complexity' => CodeMartV1Constants::COMPLEXITY_COMPLEX,
            'budget' => 58000,
            'skills' => ['Python', 'Laravel', 'React'],
        ]);

        $this->seedProject($clientId, [
            'title' => 'Logistics Route Optimization Engine',
            'description' => 'Route planning service that cuts delivery mileage across the regional fleet. Proposal accepted; funding confirmation pending.',
            'status' => CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING,
            'complexity' => CodeMartV1Constants::COMPLEXITY_VERY_COMPLEX,
            'budget' => 96000,
            'skills' => ['Python', 'PostgreSQL'],
        ]);
    }

    private function seedProject(int $clientId, array $attributes, ?int $architectId = null): CodeMartV1ProjectModel
    {
        $project = CodeMartV1ProjectModel::query()->updateOrCreate(
            ['client_id' => $clientId, 'title' => $attributes['title']],
            [
                'description' => $attributes['description'],
                'status' => $attributes['status'],
                'complexity' => $attributes['complexity'],
                'budget' => $attributes['budget'],
                'budget_type' => CodeMartV1Constants::BUDGET_TYPE_FIXED,
                'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                'skills' => json_encode($attributes['skills']),
            ]
        );

        if ($architectId !== null && $project->architect_id !== $architectId) {
            $project->architect_id = $architectId;
            $project->save();
        }

        return $project;
    }

    private function seedMilestone(int $projectId, string $title, string $description, string $status, int $order, int $budget, int $dueInDays): CodeMartV1MilestoneModel
    {
        return CodeMartV1MilestoneModel::query()->updateOrCreate(
            ['project_id' => $projectId, 'title' => $title],
            [
                'description' => $description,
                'status' => $status,
                'order' => $order,
                'budget' => $budget,
                'due_date' => now()->addDays($dueInDays)->toDateString(),
                'deliverables' => json_encode([]),
                'completed_at' => $status === CodeMartV1Constants::MILESTONE_STATUS_COMPLETED ? now() : null,
            ]
        );
    }

    private function seedTask(int $milestoneId, string $title, string $description, string $status, string $priority, ?int $assignedTo, int $budgetAllocation, int $dueInDays, array $requiredSkills): void
    {
        $task = CodeMartV1TaskModel::query()->updateOrCreate(
            ['milestone_id' => $milestoneId, 'title' => $title],
            [
                'description' => $description,
                'status' => $status,
                'priority' => $priority,
                'assigned_to' => $assignedTo,
                'budget_allocation' => $budgetAllocation,
                'due_date' => now()->addDays($dueInDays)->toDateString(),
            ]
        );

        $task->required_skills = $requiredSkills;
        $task->save();
    }

    private function syncProjectMilestoneCounts(CodeMartV1ProjectModel $project): void
    {
        $milestones = CodeMartV1MilestoneModel::query()->where('project_id', $project->id)->get();
        $project->total_milestones = $milestones->count();
        $project->completed_milestones = $milestones->where('status', CodeMartV1Constants::MILESTONE_STATUS_COMPLETED)->count();
        $project->save();
    }

    private function seedTestimonials(): void
    {
        $testimonials = [
            [
                'quote_key' => 'CodeMart turned our inventory brief into a managed delivery with verified reviewers at every step. The escrowed milestones kept the budget predictable.',
                'author_label' => 'Operations Director, Northwind Retail Group',
                'role_label' => 'Client',
                'display_order' => 1,
            ],
            [
                'quote_key' => 'The marketplace matching is fair: tasks are scoped, priced and reviewed. I know exactly what done means before I accept.',
                'author_label' => 'Full-stack Engineer',
                'role_label' => 'Developer',
                'display_order' => 2,
            ],
            [
                'quote_key' => 'As an architect I get clean requirements from the AI analysis cycle and a review pipeline that protects delivery quality.',
                'author_label' => 'Solution Architect',
                'role_label' => 'Architect',
                'display_order' => 3,
            ],
        ];

        foreach ($testimonials as $testimonial) {
            CodeMartV1TestimonialModel::query()->updateOrCreate(
                ['quote_key' => $testimonial['quote_key']],
                [
                    'author_label' => $testimonial['author_label'],
                    'role_label' => $testimonial['role_label'],
                    'avatar_url' => null,
                    'approved' => true,
                    'display_order' => $testimonial['display_order'],
                ]
            );
        }
    }
}
