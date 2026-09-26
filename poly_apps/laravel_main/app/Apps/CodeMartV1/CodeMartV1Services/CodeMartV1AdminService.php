<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ActivityModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ClientProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ContactMessageModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1KycVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ReviewerApplicationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TestimonialModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1PublicHomeService;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-administration operations for CodeMart. Every method requires the
 * caller to have passed the global Laravel administrator check in the
 * controller; CodeMart role membership never grants admin rights. Failures
 * are returned as ['error_code', 'http_status', 'message'] arrays; every
 * mutation is recorded through CodeMartV1DomainEventService.
 */
class CodeMartV1AdminService
{
    private const DETAIL_LIST_LIMIT = 50;

    public function __construct(private readonly CodeMartV1FileUploadService $fileUploadService)
    {
    }

    public static function failure(string $errorCode, int $httpStatus, string $message): array
    {
        return ['error_code' => $errorCode, 'http_status' => $httpStatus, 'message' => $message];
    }

    public static function isFailure(?array $result): bool
    {
        return is_array($result) && isset($result['error_code'], $result['http_status']);
    }

    private static function codemartConnection(): string
    {
        return AppTablePrefixServiceProvider::getConnection(AppKeys::CODEMARTV1);
    }

    private static function codemartTableExists(string $tableName): bool
    {
        try {
            return Schema::connection(self::codemartConnection())->hasTable($tableName);
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function likeOperator(Builder $query): string
    {
        return $query->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }

    private static function applySearch(Builder $query, string $search, array $columns): void
    {
        if ($search === '') {
            return;
        }

        $operator = self::likeOperator($query);
        $query->where(function ($builder) use ($search, $columns, $operator): void {
            foreach ($columns as $column) {
                $builder->orWhere($column, $operator, '%' . $search . '%');
            }
        });
    }

    private static function paginate(Builder $query, int $page, int $pageSize, string $itemsKey, callable $mapper): array
    {
        $total = (clone $query)->count();

        return [
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            $itemsKey => $query->forPage($page, $pageSize)->get()->map($mapper)->values()->all(),
        ];
    }

    /**
     * @param int[] $userIds
     * @return array<int, array{id:int,username:?string,email:?string,name:?string}>
     */
    private static function userSummaries(array $userIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if ($ids === []) {
            return [];
        }

        return CodeMartV1UserModel::query()
            ->whereIn('id', $ids)
            ->get(['id', 'username', 'email', 'name'])
            ->mapWithKeys(static fn (CodeMartV1UserModel $user): array => [
                (int) $user->id => [
                    'id' => (int) $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'name' => $user->name,
                ],
            ])
            ->all();
    }

    /**
     * @return int[]|null null when no user matches the text search
     */
    private static function userIdsMatching(string $search): ?array
    {
        if ($search === '') {
            return null;
        }

        $query = CodeMartV1UserModel::query();
        self::applySearch($query, $search, ['username', 'email', 'name']);

        return $query->limit(500)->pluck('id')->map(static fn ($id): int => (int) $id)->all();
    }

    private static function iso($value): ?string
    {
        return $value?->toIso8601String();
    }

    public function overview(): array
    {
        $projectsByStatus = CodeMartV1ProjectModel::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $withdrawalsPending = self::codemartTableExists(CodeMartV1TablesMaps::CODEMART_WITHDRAWALS_TABLE)
            ? DB::connection(self::codemartConnection())
                ->table(CodeMartV1TablesMaps::CODEMART_WITHDRAWALS_TABLE)
                ->where('status', CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING)
                ->count()
            : 0;

        $testimonialsPending = self::codemartTableExists(CodeMartV1TablesMaps::TESTIMONIALS_TABLE)
            ? CodeMartV1TestimonialModel::query()
                ->where('approved', false)
                ->where('status', CodeMartV1Constants::TESTIMONIAL_STATUS_PENDING)
                ->count()
            : 0;

        $contactMessagesNew = self::codemartTableExists(CodeMartV1TablesMaps::CONTACT_MESSAGES_TABLE)
            ? CodeMartV1ContactMessageModel::query()
                ->where('status', CodeMartV1Constants::CONTACT_STATUS_NEW)
                ->count()
            : 0;

        return [
            'users_total' => CodeMartV1UserModel::query()->count(),
            'codeMart_role_holders' => CodeMartV1UserRoleModel::query()->distinct()->count('user_id'),
            'roles_pending' => CodeMartV1UserRoleModel::query()
                ->where('role_status', CodeMartV1Constants::ROLE_STATUS_PENDING)
                ->count(),
            'projects_total' => CodeMartV1ProjectModel::query()->count(),
            'projects_by_status' => $projectsByStatus,
            'tasks_total' => CodeMartV1TaskModel::query()->count(),
            'kyc_pending' => CodeMartV1KycVerificationModel::query()
                ->where('verification_status', CodeMartV1Constants::KYC_STATUS_PENDING)
                ->count(),
            'refunds_pending' => CodeMartV1RefundModel::query()
                ->where('status', CodeMartV1Constants::REFUND_STATUS_PENDING)
                ->count(),
            'deposits_pending' => CodeMartV1DepositModel::query()
                ->where('status', CodeMartV1Constants::DEPOSIT_STATUS_PENDING)
                ->count(),
            'withdrawals_pending' => $withdrawalsPending,
            'testimonials_pending' => $testimonialsPending,
            'contact_messages_new' => $contactMessagesNew,
            'reviewer_applications_passed' => CodeMartV1ReviewerApplicationModel::query()
                ->where('status', CodeMartV1Constants::REVIEWER_APPLICATION_PASSED)
                ->whereNull('revoked_at')
                ->count(),
        ];
    }

    public function usersPage(array $filters, int $page, int $pageSize): array
    {
        $search = (string) ($filters['search'] ?? '');
        $roleType = (string) ($filters['role'] ?? '');
        $roleStatus = (string) ($filters['status'] ?? '');

        $query = CodeMartV1UserModel::query()->with('userRoles');
        self::applySearch($query, $search, ['username', 'email', 'name']);

        if ($roleType !== '' || $roleStatus !== '') {
            $roleQuery = CodeMartV1UserRoleModel::query();
            if ($roleType !== '') {
                $roleQuery->where('role_type', $roleType);
            }
            if ($roleStatus !== '') {
                $roleQuery->where('role_status', $roleStatus);
            }
            $query->whereIn('id', $roleQuery->distinct()->pluck('user_id')->all());
        }

        $query->orderByDesc('id');

        return self::paginate($query, $page, $pageSize, 'users', static fn (CodeMartV1UserModel $user): array => [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'name' => $user->name,
            'rolelevel' => (int) $user->rolelevel,
            'rolename' => $user->rolename,
            'is_admin' => (int) $user->rolelevel >= 10,
            'roles' => $user->roleStatusMap(),
            'created_at' => self::iso($user->created_at),
        ]);
    }

    public function userDetail(int $userId): array
    {
        $user = CodeMartV1UserModel::findRegistration($userId);
        if (!$user) {
            return self::failure(CodeMartV1Constants::ERROR_USER_NOT_FOUND, 404, 'User not found');
        }

        $developerProfile = CodeMartV1DeveloperProfileModel::query()->where('user_id', $userId)->first();
        $clientProfile = CodeMartV1ClientProfileModel::query()->where('user_id', $userId)->first();
        $wallet = CodeMartV1WalletModel::query()->where('user_id', $userId)->first();

        $kycRecords = CodeMartV1KycVerificationModel::query()
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->get()
            ->map(fn (CodeMartV1KycVerificationModel $kyc): array => $this->serializeKyc($kyc))
            ->all();

        $deposits = CodeMartV1DepositModel::query()
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->limit(self::DETAIL_LIST_LIMIT)
            ->get()
            ->map(static fn (CodeMartV1DepositModel $deposit): array => [
                'id' => $deposit->id,
                'role_type' => $deposit->role_type,
                'amount' => (string) $deposit->amount,
                'payment_method' => $deposit->payment_method,
                'status' => $deposit->status,
                'paid_at' => self::iso($deposit->paid_at),
                'created_at' => self::iso($deposit->created_at),
            ])
            ->all();

        $projects = CodeMartV1ProjectModel::query()
            ->where('client_id', $userId)
            ->orderByDesc('id')
            ->limit(self::DETAIL_LIST_LIMIT)
            ->get()
            ->map(static fn (CodeMartV1ProjectModel $project): array => [
                'id' => $project->id,
                'title' => $project->title,
                'status' => $project->status,
                'budget' => $project->budget !== null ? (string) $project->budget : null,
                'currency' => $project->currency,
                'created_at' => self::iso($project->created_at),
            ])
            ->all();

        $tasks = CodeMartV1TaskModel::query()
            ->where('assigned_to', $userId)
            ->orderByDesc('id')
            ->limit(self::DETAIL_LIST_LIMIT)
            ->get()
            ->map(static fn (CodeMartV1TaskModel $task): array => [
                'id' => $task->id,
                'milestone_id' => $task->milestone_id,
                'title' => $task->title,
                'status' => $task->status,
                'budget_allocation' => $task->budget_allocation !== null ? (string) $task->budget_allocation : null,
                'due_date' => self::iso($task->due_date),
            ])
            ->all();

        $roleIds = $user->userRoles->pluck('id')->all();
        $activity = CodeMartV1ActivityModel::query()
            ->where(function ($builder) use ($userId, $roleIds): void {
                $builder->where('actor_id', $userId)
                    ->orWhere(function ($inner) use ($userId): void {
                        $inner->where('resource_type', CodeMartV1Constants::RESOURCE_USER)->where('resource_id', $userId);
                    });
                if ($roleIds !== []) {
                    $builder->orWhere(function ($inner) use ($roleIds): void {
                        $inner->where('resource_type', CodeMartV1Constants::RESOURCE_USER_ROLE)->whereIn('resource_id', $roleIds);
                    });
                }
            })
            ->orderByDesc('id')
            ->limit(self::DETAIL_LIST_LIMIT)
            ->get()
            ->map(static fn (CodeMartV1ActivityModel $row): array => self::serializeActivity($row, []))
            ->all();

        return [
            'account' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'name' => $user->name,
                'nickname' => $user->nickname,
                'rolelevel' => (int) $user->rolelevel,
                'rolename' => $user->rolename,
                'is_admin' => (int) $user->rolelevel >= 10,
                'email_verified' => $user->email_verified_at !== null,
                'phone_verified' => $user->hasVerifiedPhone(),
                'created_at' => self::iso($user->created_at),
            ],
            'roles' => $user->userRoles->map(static fn (CodeMartV1UserRoleModel $role): array => [
                'id' => $role->id,
                'role_type' => $role->role_type,
                'role_status' => $role->role_status,
                'deposit_amount' => $role->deposit_amount !== null ? (string) $role->deposit_amount : null,
                'role_activated_at' => self::iso($role->role_activated_at),
                'allowed_transitions' => CodeMartV1Constants::ROLE_STATUS_TRANSITIONS[$role->role_status] ?? [],
                'created_at' => self::iso($role->created_at),
            ])->values()->all(),
            'profiles' => [
                'developer' => $developerProfile ? [
                    'company_name' => $developerProfile->company_name,
                    'bio' => $developerProfile->bio,
                    'skills' => $developerProfile->skills,
                    'completed_projects' => (int) $developerProfile->completed_projects,
                    'average_rating' => (string) $developerProfile->average_rating,
                ] : null,
                'client' => $clientProfile ? [
                    'company_name' => $clientProfile->company_name,
                    'industry' => $clientProfile->industry,
                    'contact_person' => $clientProfile->contact_person,
                    'contact_phone' => $clientProfile->contact_phone,
                    'company_website' => $clientProfile->company_website,
                    'posted_projects' => (int) $clientProfile->posted_projects,
                ] : null,
            ],
            'kyc' => $kycRecords,
            'deposits' => $deposits,
            'wallet' => [
                'balance' => $wallet ? (string) $wallet->balance : '0.00',
                'available_balance' => $wallet ? (string) $wallet->available_balance : '0.00',
                'frozen_balance' => $wallet ? (string) $wallet->frozen_balance : '0.00',
                'currency' => $wallet?->currency ?? CodeMartV1Constants::DEFAULT_CURRENCY,
            ],
            'projects' => $projects,
            'tasks' => $tasks,
            'activity' => $activity,
        ];
    }

    /**
     * Server-enforced role transitions (ROLE_STATUS_TRANSITIONS); suspend and
     * reject require a reason. Re-applying the current status is a no-op.
     */
    public function setRoleStatus(int $userId, string $roleType, string $status, ?string $reason, int $adminId): array
    {
        $reason = $reason !== null ? trim($reason) : null;

        if (!in_array($roleType, CodeMartV1Constants::getAllRoles(), true)) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_ROLE_TYPE, 422, 'Unknown role type');
        }

        $role = CodeMartV1UserRoleModel::forUserAndType($userId, $roleType);
        if (!$role) {
            return self::failure(CodeMartV1Constants::ERROR_ROLE_NOT_FOUND, 404, 'Role assignment not found');
        }

        $fromStatus = (string) $role->role_status;
        if ($fromStatus === $status) {
            return [
                'user_id' => $userId,
                'role_type' => $roleType,
                'role_status' => $status,
                'unchanged' => true,
            ];
        }

        if (!in_array($status, CodeMartV1Constants::ROLE_STATUS_TRANSITIONS[$fromStatus] ?? [], true)) {
            return self::failure(
                CodeMartV1Constants::ERROR_INVALID_ROLE_TRANSITION,
                409,
                'Role status transition is not allowed'
            );
        }

        if (in_array($status, CodeMartV1Constants::ROLE_STATUS_REASON_REQUIRED, true) && ($reason === null || $reason === '')) {
            return self::failure(CodeMartV1Constants::ERROR_REASON_REQUIRED, 422, 'A reason is required');
        }

        $attributes = ['role_status' => $status];
        if ($status === CodeMartV1Constants::ROLE_STATUS_ACTIVE && $role->role_activated_at === null) {
            $attributes['role_activated_at'] = now();
        }
        $role->update($attributes);

        CodeMartV1DomainEventService::emit(
            $adminId,
            CodeMartV1Constants::RESOURCE_USER_ROLE,
            (int) $role->id,
            'admin_role_status_changed',
            $fromStatus,
            $status,
            [$userId],
            CodeMartV1Constants::NOTIFICATION_TYPE_ADMIN,
            'notifications.roleStatusChanged',
            'notifications.roleStatusChangedBody',
            ['role' => $roleType, 'status' => $status, 'reason' => $reason, 'user_id' => $userId, 'admin_id' => $adminId]
        );

        return [
            'user_id' => $userId,
            'role_type' => $roleType,
            'role_status' => $status,
            'previous_status' => $fromStatus,
            'unchanged' => false,
        ];
    }

    public function grantRole(int $userId, string $roleType, string $status, ?string $reason, int $adminId): array
    {
        if (!in_array($roleType, CodeMartV1Constants::getAllRoles(), true)) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_ROLE_TYPE, 422, 'Unknown role type');
        }

        if (!CodeMartV1UserModel::query()->whereKey($userId)->exists()) {
            return self::failure(CodeMartV1Constants::ERROR_USER_NOT_FOUND, 404, 'User not found');
        }

        if (CodeMartV1UserRoleModel::forUserAndType($userId, $roleType)) {
            return self::failure(CodeMartV1Constants::ERROR_ROLE_ALREADY_EXISTS, 409, 'Role assignment already exists');
        }

        $role = CodeMartV1UserRoleModel::createRecord([
            'user_id' => $userId,
            'role_type' => $roleType,
            'role_status' => $status,
            'role_activated_at' => $status === CodeMartV1Constants::ROLE_STATUS_ACTIVE ? now() : null,
        ]);

        CodeMartV1DomainEventService::emit(
            $adminId,
            CodeMartV1Constants::RESOURCE_USER_ROLE,
            (int) $role->id,
            'admin_role_granted',
            null,
            $status,
            [$userId],
            CodeMartV1Constants::NOTIFICATION_TYPE_ADMIN,
            'notifications.roleGranted',
            'notifications.roleGrantedBody',
            ['role' => $roleType, 'status' => $status, 'reason' => $reason, 'user_id' => $userId, 'admin_id' => $adminId]
        );

        return [
            'id' => $role->id,
            'user_id' => $userId,
            'role_type' => $roleType,
            'role_status' => $status,
        ];
    }

    private function kycDocuments(CodeMartV1KycVerificationModel $kyc): array
    {
        $documents = [];
        foreach (CodeMartV1Constants::KYC_FILE_COLUMNS as $type => $column) {
            $documents[$type] = $this->fileUploadService->locateKycFile($kyc->{$column}) !== null;
        }

        return $documents;
    }

    private function serializeKyc(CodeMartV1KycVerificationModel $kyc, ?array $user = null): array
    {
        return [
            'id' => $kyc->id,
            'user_id' => $kyc->user_id,
            'user' => $user,
            'identity_type' => $kyc->identity_type,
            'real_name' => $kyc->real_name,
            'verification_status' => $kyc->verification_status,
            'verification_notes' => $kyc->verification_notes,
            'verified_at' => self::iso($kyc->verified_at),
            'verified_by' => $kyc->verified_by !== null ? (int) $kyc->verified_by : null,
            'documents' => $this->kycDocuments($kyc),
            'reviewable' => $kyc->verification_status === CodeMartV1Constants::KYC_STATUS_PENDING,
            'submitted_at' => self::iso($kyc->created_at),
        ];
    }

    public function kycPage(array $filters, int $page, int $pageSize): array
    {
        $status = (string) ($filters['status'] ?? '');
        $search = (string) ($filters['search'] ?? '');
        $identityType = (string) ($filters['identity_type'] ?? '');

        $query = CodeMartV1KycVerificationModel::query();
        if ($status !== '') {
            $query->where('verification_status', $status);
        }
        if ($identityType !== '') {
            $query->where('identity_type', $identityType);
        }
        if ($search !== '') {
            $matchedUserIds = self::userIdsMatching($search) ?? [];
            $operator = self::likeOperator($query);
            $query->where(function ($builder) use ($search, $operator, $matchedUserIds): void {
                $builder->where('real_name', $operator, '%' . $search . '%');
                if ($matchedUserIds !== []) {
                    $builder->orWhereIn('user_id', $matchedUserIds);
                }
            });
        }
        $query->orderByDesc('id');

        $result = self::paginate($query, $page, $pageSize, 'items', static fn ($kyc) => $kyc);
        $users = self::userSummaries(array_map(static fn ($kyc): int => (int) $kyc->user_id, $result['items']));
        $result['items'] = array_map(
            fn (CodeMartV1KycVerificationModel $kyc): array => $this->serializeKyc($kyc, $users[(int) $kyc->user_id] ?? null),
            $result['items']
        );

        return $result;
    }

    public function reviewKyc(int $kycId, bool $approved, ?string $notes, int $adminId): array
    {
        $notes = $notes !== null ? trim($notes) : null;

        $kyc = CodeMartV1KycVerificationModel::findById($kycId);
        if (!$kyc) {
            return self::failure(CodeMartV1Constants::ERROR_KYC_NOT_FOUND, 404, 'KYC submission not found');
        }

        if ($kyc->verification_status !== CodeMartV1Constants::KYC_STATUS_PENDING) {
            return self::failure(CodeMartV1Constants::ERROR_KYC_NOT_PENDING, 409, 'KYC submission is not pending');
        }

        if (!$approved && ($notes === null || $notes === '')) {
            return self::failure(CodeMartV1Constants::ERROR_REASON_REQUIRED, 422, 'Rejection notes are required');
        }

        $status = $approved
            ? CodeMartV1Constants::KYC_STATUS_APPROVED
            : CodeMartV1Constants::KYC_STATUS_REJECTED;

        $updated = CodeMartV1KycVerificationModel::query()
            ->whereKey($kyc->id)
            ->where('verification_status', CodeMartV1Constants::KYC_STATUS_PENDING)
            ->update([
                'verification_status' => $status,
                'verification_notes' => $notes,
                'verified_at' => now(),
                'verified_by' => (string) $adminId,
                'updated_at' => now(),
            ]);

        if ($updated === 0) {
            return self::failure(CodeMartV1Constants::ERROR_KYC_NOT_PENDING, 409, 'KYC submission is not pending');
        }

        CodeMartV1DomainEventService::emit(
            $adminId,
            CodeMartV1Constants::RESOURCE_KYC,
            (int) $kyc->id,
            $approved ? 'admin_kyc_approved' : 'admin_kyc_rejected',
            CodeMartV1Constants::KYC_STATUS_PENDING,
            $status,
            [(int) $kyc->user_id],
            CodeMartV1Constants::NOTIFICATION_TYPE_ONBOARDING,
            $approved ? 'notifications.kycApproved' : 'notifications.kycRejected',
            $approved ? 'notifications.kycApprovedBody' : 'notifications.kycRejectedBody',
            ['notes' => $notes, 'user_id' => (int) $kyc->user_id, 'admin_id' => $adminId]
        );

        return [
            'id' => $kyc->id,
            'verification_status' => $status,
        ];
    }

    /**
     * @return array{disk:string,path:string}|array{error_code:string,http_status:int,message:string}
     */
    public function kycFile(int $kycId, string $type): array
    {
        $column = CodeMartV1Constants::KYC_FILE_COLUMNS[$type] ?? null;
        if ($column === null) {
            return self::failure(CodeMartV1Constants::ERROR_KYC_FILE_NOT_FOUND, 404, 'Unknown KYC document type');
        }

        $kyc = CodeMartV1KycVerificationModel::findById($kycId);
        if (!$kyc) {
            return self::failure(CodeMartV1Constants::ERROR_KYC_NOT_FOUND, 404, 'KYC submission not found');
        }

        $location = $this->fileUploadService->locateKycFile($kyc->{$column});
        if ($location === null) {
            return self::failure(CodeMartV1Constants::ERROR_KYC_FILE_NOT_FOUND, 404, 'KYC document not found');
        }

        return $location;
    }

    public function refundsPage(string $status, int $page, int $pageSize): array
    {
        $query = CodeMartV1RefundModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }

        return [
            'total' => (clone $query)->count(),
            'page' => $page,
            'page_size' => $pageSize,
            'items' => $query->orderByDesc('id')->forPage($page, $pageSize)->get(),
        ];
    }

    public function depositsPage(string $status, int $page, int $pageSize): array
    {
        $query = CodeMartV1DepositModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }

        return [
            'total' => (clone $query)->count(),
            'page' => $page,
            'page_size' => $pageSize,
            'items' => $query->orderByDesc('id')->forPage($page, $pageSize)->get(),
        ];
    }

    /**
     * Confirm a pending deposit and, only when the role's deposit policy is
     * satisfied (architect counts the cumulative developer deposit), activate
     * the matching pending role. Re-confirming a paid deposit is a no-op.
     */
    public function confirmDeposit(int $depositId, int $adminId): array
    {
        $deposit = CodeMartV1DepositModel::findById($depositId);
        if (!$deposit) {
            return self::failure('deposit_not_found', 404, 'Deposit not found');
        }

        if ($deposit->status === CodeMartV1Constants::DEPOSIT_STATUS_PAID) {
            $policy = CodeMartV1DepositModel::policyForRole((int) $deposit->user_id, (string) $deposit->role_type);

            return [
                'id' => $deposit->id,
                'status' => $deposit->status,
                'role_activated' => CodeMartV1UserRoleModel::forUserAndType(
                    (int) $deposit->user_id,
                    (string) $deposit->role_type,
                    CodeMartV1Constants::ROLE_STATUS_ACTIVE
                ) !== null,
                'policy' => $policy,
                'idempotent_replay' => true,
            ];
        }

        $outcome = CodeMartV1DepositModel::runInTransaction(function () use ($depositId, $adminId): array {
            $locked = CodeMartV1DepositModel::lockById($depositId);
            if (!$locked || $locked->status !== CodeMartV1Constants::DEPOSIT_STATUS_PENDING) {
                return ['error' => true, 'status' => $locked?->status];
            }

            $locked->update([
                'status' => CodeMartV1Constants::DEPOSIT_STATUS_PAID,
                'paid_at' => now(),
                'admin_id' => $adminId,
                'reviewed_at' => now(),
            ]);

            $policy = CodeMartV1DepositModel::policyForRole((int) $locked->user_id, (string) $locked->role_type);
            $roleActivated = false;
            $roleId = null;

            $role = CodeMartV1UserRoleModel::forUserAndType((int) $locked->user_id, (string) $locked->role_type);
            if ($role && $policy['is_sufficient'] === true
                && $role->role_status === CodeMartV1Constants::ROLE_STATUS_PENDING) {
                $role->update([
                    'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                    'role_activated_at' => now(),
                    'deposit_amount' => $policy['paid_amount'],
                ]);
                $roleActivated = true;
                $roleId = (int) $role->id;
            }

            return [
                'error' => false,
                'deposit' => $locked,
                'policy' => $policy,
                'role_activated' => $roleActivated,
                'role_id' => $roleId,
            ];
        });

        if ($outcome['error'] === true) {
            return self::failure('deposit_invalid_state', 409, 'Only pending deposits can be confirmed');
        }

        $fresh = $outcome['deposit'];
        $userId = (int) $fresh->user_id;

        CodeMartV1DomainEventService::emit(
            $adminId,
            'deposit',
            (int) $fresh->id,
            'deposit_confirmed',
            CodeMartV1Constants::DEPOSIT_STATUS_PENDING,
            CodeMartV1Constants::DEPOSIT_STATUS_PAID,
            [$userId],
            CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            'notifications.depositConfirmed',
            'notifications.depositConfirmedBody',
            [
                'amount' => (string) $fresh->amount,
                'role' => $fresh->role_type,
                'role_activated' => $outcome['role_activated'],
                'remaining_amount' => $outcome['policy']['remaining_amount'],
                'admin_id' => $adminId,
            ]
        );

        if ($outcome['role_activated']) {
            CodeMartV1DomainEventService::emit(
                $adminId,
                CodeMartV1Constants::RESOURCE_USER_ROLE,
                (int) $outcome['role_id'],
                'role_activated_by_deposit',
                CodeMartV1Constants::ROLE_STATUS_PENDING,
                CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                [$userId],
                CodeMartV1Constants::NOTIFICATION_TYPE_ONBOARDING,
                'notifications.roleStatusChanged',
                'notifications.roleStatusChangedBody',
                ['role' => $fresh->role_type, 'status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE, 'user_id' => $userId, 'admin_id' => $adminId]
            );
        }

        return [
            'id' => $fresh->id,
            'status' => $fresh->status,
            'role_activated' => $outcome['role_activated'],
            'policy' => $outcome['policy'],
            'idempotent_replay' => false,
        ];
    }

    public function projectsPage(array $filters, int $page, int $pageSize): array
    {
        $status = (string) ($filters['status'] ?? '');
        $search = (string) ($filters['search'] ?? '');
        $clientId = (int) ($filters['client_id'] ?? 0);

        $query = CodeMartV1ProjectModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }
        if ($clientId > 0) {
            $query->where('client_id', $clientId);
        }
        self::applySearch($query, $search, ['title']);
        $query->orderByDesc('id');

        $result = self::paginate($query, $page, $pageSize, 'items', static fn ($project) => $project);
        $clients = self::userSummaries(array_map(static fn ($project): int => (int) $project->client_id, $result['items']));
        $result['items'] = array_map(
            static fn (CodeMartV1ProjectModel $project): array => [
                'id' => $project->id,
                'client_id' => $project->client_id,
                'client' => $clients[(int) $project->client_id] ?? null,
                'title' => $project->title,
                'status' => $project->status,
                'complexity' => $project->complexity,
                'budget' => $project->budget !== null ? (string) $project->budget : null,
                'budget_type' => $project->budget_type,
                'currency' => $project->currency,
                'admin_transitions' => self::adminProjectTargets((string) $project->status),
                'created_at' => self::iso($project->created_at),
            ],
            $result['items']
        );

        return $result;
    }

    private static function adminProjectTargets(string $fromStatus): array
    {
        return array_values(array_intersect(
            CodeMartV1ProjectStateService::allowedTargets($fromStatus, CodeMartV1Constants::TRANSITION_ACTOR_ADMIN),
            CodeMartV1Constants::ADMIN_PROJECT_TARGET_STATUSES
        ));
    }

    /**
     * Administrator intervention (pause / resume / cancel / archive) through
     * the shared project state machine with administrator override.
     */
    public function setProjectStatus(int $projectId, string $toStatus, ?string $reason, int $adminId): array
    {
        $reason = $reason !== null ? trim($reason) : null;

        $project = CodeMartV1ProjectModel::findById($projectId);
        if (!$project) {
            return self::failure(CodeMartV1Constants::ERROR_PROJECT_NOT_FOUND, 404, 'Project not found');
        }

        if ($reason === null || $reason === '') {
            return self::failure(CodeMartV1Constants::ERROR_REASON_REQUIRED, 422, 'A reason is required');
        }

        if (!in_array($toStatus, CodeMartV1Constants::ADMIN_PROJECT_TARGET_STATUSES, true)) {
            return self::failure(
                CodeMartV1Constants::ERROR_INVALID_PROJECT_TRANSITION,
                409,
                'Project status transition is not allowed'
            );
        }

        $result = CodeMartV1ProjectStateService::transition($project, $toStatus, $adminId, $reason, true);
        if (($result['ok'] ?? false) !== true) {
            return self::failure(
                (string) ($result['error_code'] ?? CodeMartV1Constants::ERROR_INVALID_PROJECT_TRANSITION),
                (int) ($result['http_status'] ?? 409),
                (string) ($result['message'] ?? 'Project status transition is not allowed')
            );
        }

        return [
            'id' => (int) $project->id,
            'from_status' => $result['from'],
            'status' => $result['to'],
            'side_effects' => $result['side_effects'] ?? [],
            'admin_transitions' => self::adminProjectTargets((string) $result['to']),
        ];
    }

    private static function serializeTestimonial(CodeMartV1TestimonialModel $testimonial, ?array $user = null): array
    {
        return [
            'id' => $testimonial->id,
            'status' => $testimonial->effectiveStatus(),
            'approved' => (bool) $testimonial->approved,
            'quote_key' => $testimonial->quote_key,
            'quotes' => $testimonial->quotes,
            'author_label' => $testimonial->author_label,
            'role_label' => $testimonial->role_label,
            'role_labels' => $testimonial->role_labels,
            'avatar_url' => $testimonial->avatar_url,
            'sort_order' => (int) $testimonial->display_order,
            'user_id' => $testimonial->user_id !== null ? (int) $testimonial->user_id : null,
            'user' => $user,
            'project_id' => $testimonial->project_id !== null ? (int) $testimonial->project_id : null,
            'moderated_by' => $testimonial->moderated_by !== null ? (int) $testimonial->moderated_by : null,
            'moderated_at' => self::iso($testimonial->moderated_at),
            'created_at' => self::iso($testimonial->created_at),
        ];
    }

    public function testimonialsPage(array $filters, int $page, int $pageSize): array
    {
        $status = (string) ($filters['status'] ?? '');
        $search = (string) ($filters['search'] ?? '');

        $query = CodeMartV1TestimonialModel::query();
        if ($status === CodeMartV1Constants::TESTIMONIAL_STATUS_APPROVED) {
            $query->where('approved', true);
        } elseif ($status !== '') {
            $query->where('approved', false)->where('status', $status);
        }
        self::applySearch($query, $search, ['author_label', 'quote_key']);
        $query->orderBy('display_order')->orderByDesc('id');

        $result = self::paginate($query, $page, $pageSize, 'items', static fn ($row) => $row);
        $users = self::userSummaries(array_map(static fn ($row): int => (int) $row->user_id, $result['items']));
        $result['items'] = array_map(
            static fn (CodeMartV1TestimonialModel $row): array => self::serializeTestimonial($row, $users[(int) $row->user_id] ?? null),
            $result['items']
        );

        return $result;
    }

    public function moderateTestimonial(int $testimonialId, bool $approve, int $adminId): array
    {
        $testimonial = CodeMartV1TestimonialModel::findById($testimonialId);
        if (!$testimonial) {
            return self::failure(CodeMartV1Constants::ERROR_TESTIMONIAL_NOT_FOUND, 404, 'Testimonial not found');
        }

        $fromStatus = $testimonial->effectiveStatus();
        $toStatus = $approve
            ? CodeMartV1Constants::TESTIMONIAL_STATUS_APPROVED
            : CodeMartV1Constants::TESTIMONIAL_STATUS_HIDDEN;

        $testimonial->update([
            'approved' => $approve,
            'status' => $toStatus,
            'moderated_by' => $adminId,
            'moderated_at' => now(),
        ]);

        $this->forgetPublicHome();

        CodeMartV1DomainEventService::emit(
            $adminId,
            CodeMartV1Constants::RESOURCE_TESTIMONIAL,
            (int) $testimonial->id,
            $approve ? 'admin_testimonial_approved' : 'admin_testimonial_hidden',
            $fromStatus,
            $toStatus,
            $testimonial->user_id !== null ? [(int) $testimonial->user_id] : [],
            CodeMartV1Constants::NOTIFICATION_TYPE_ADMIN,
            $approve ? 'notifications.testimonialApproved' : 'notifications.testimonialHidden',
            $approve ? 'notifications.testimonialApprovedBody' : 'notifications.testimonialHiddenBody',
            ['admin_id' => $adminId]
        );

        return self::serializeTestimonial($testimonial->fresh());
    }

    public function updateTestimonial(int $testimonialId, array $attributes, int $adminId): array
    {
        $testimonial = CodeMartV1TestimonialModel::findById($testimonialId);
        if (!$testimonial) {
            return self::failure(CodeMartV1Constants::ERROR_TESTIMONIAL_NOT_FOUND, 404, 'Testimonial not found');
        }

        $changes = [];
        if (array_key_exists('sort_order', $attributes)) {
            $changes['display_order'] = (int) $attributes['sort_order'];
        }
        foreach (['quotes', 'role_labels', 'author_label', 'role_label', 'avatar_url'] as $field) {
            if (array_key_exists($field, $attributes)) {
                $changes[$field] = $attributes[$field];
            }
        }

        if ($changes !== []) {
            $testimonial->update($changes);
            $this->forgetPublicHome();

            CodeMartV1DomainEventService::emit(
                $adminId,
                CodeMartV1Constants::RESOURCE_TESTIMONIAL,
                (int) $testimonial->id,
                'admin_testimonial_updated',
                null,
                null,
                [],
                null,
                null,
                null,
                ['fields' => array_keys($changes), 'admin_id' => $adminId]
            );
        }

        return self::serializeTestimonial($testimonial->fresh());
    }

    public function reviewerApplicationsPage(array $filters, int $page, int $pageSize): array
    {
        $status = (string) ($filters['status'] ?? '');
        $search = (string) ($filters['search'] ?? '');

        $query = CodeMartV1ReviewerApplicationModel::query();
        if ($status === CodeMartV1Constants::REVIEWER_APPLICATION_REVOKED) {
            $query->whereNotNull('revoked_at');
        } elseif ($status !== '') {
            $query->where('status', $status)->whereNull('revoked_at');
        }
        if ($search !== '') {
            $query->whereIn('user_id', self::userIdsMatching($search) ?? []);
        }
        $query->orderByDesc('id');

        $result = self::paginate($query, $page, $pageSize, 'items', static fn ($row) => $row);
        $userIds = array_map(static fn ($row): int => (int) $row->user_id, $result['items']);
        $users = self::userSummaries($userIds);
        $roleStatuses = $userIds === [] ? [] : CodeMartV1UserRoleModel::query()
            ->whereIn('user_id', $userIds)
            ->where('role_type', CodeMartV1Constants::ROLE_REVIEWER)
            ->pluck('role_status', 'user_id')
            ->all();

        $result['items'] = array_map(
            static fn (CodeMartV1ReviewerApplicationModel $row): array => [
                'id' => $row->id,
                'user_id' => (int) $row->user_id,
                'user' => $users[(int) $row->user_id] ?? null,
                'status' => $row->revoked_at !== null ? CodeMartV1Constants::REVIEWER_APPLICATION_REVOKED : $row->status,
                'test_status' => $row->status,
                'score' => $row->similarity_score !== null ? (string) $row->similarity_score : null,
                'reviewer_role_status' => $roleStatuses[(int) $row->user_id] ?? null,
                'revocable' => $row->revoked_at === null && $row->status === CodeMartV1Constants::REVIEWER_APPLICATION_PASSED,
                'completed_at' => self::iso($row->completed_at),
                'revoked_at' => self::iso($row->revoked_at),
                'revoked_by' => $row->revoked_by !== null ? (int) $row->revoked_by : null,
                'revoke_reason' => $row->revoke_reason,
                'created_at' => self::iso($row->created_at),
            ],
            $result['items']
        );

        return $result;
    }

    public function revokeReviewer(int $applicationId, ?string $reason, int $adminId): array
    {
        $reason = $reason !== null ? trim($reason) : null;
        if ($reason === null || $reason === '') {
            return self::failure(CodeMartV1Constants::ERROR_REASON_REQUIRED, 422, 'A reason is required');
        }

        $application = CodeMartV1ReviewerApplicationModel::findById($applicationId);
        if (!$application) {
            return self::failure(
                CodeMartV1Constants::ERROR_REVIEWER_APPLICATION_NOT_FOUND,
                404,
                'Reviewer application not found'
            );
        }

        $userId = (int) $application->user_id;
        $role = CodeMartV1UserRoleModel::forUserAndType($userId, CodeMartV1Constants::ROLE_REVIEWER);
        $roleFrom = $role?->role_status;

        CodeMartV1ReviewerApplicationModel::runInTransaction(function () use ($application, $role, $reason, $adminId): void {
            $application->update([
                'revoked_at' => now(),
                'revoked_by' => $adminId,
                'revoke_reason' => $reason,
            ]);

            if ($role && $role->role_status === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
                $role->update(['role_status' => CodeMartV1Constants::ROLE_STATUS_SUSPENDED]);
            }
        });

        CodeMartV1DomainEventService::emit(
            $adminId,
            CodeMartV1Constants::RESOURCE_REVIEWER_APPLICATION,
            (int) $application->id,
            'admin_reviewer_revoked',
            $application->status,
            CodeMartV1Constants::REVIEWER_APPLICATION_REVOKED,
            [$userId],
            CodeMartV1Constants::NOTIFICATION_TYPE_ADMIN,
            'notifications.reviewerRevoked',
            'notifications.reviewerRevokedBody',
            ['reason' => $reason, 'user_id' => $userId, 'admin_id' => $adminId]
        );

        if ($role && $roleFrom === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
            CodeMartV1DomainEventService::emit(
                $adminId,
                CodeMartV1Constants::RESOURCE_USER_ROLE,
                (int) $role->id,
                'admin_role_status_changed',
                $roleFrom,
                CodeMartV1Constants::ROLE_STATUS_SUSPENDED,
                [],
                null,
                null,
                null,
                ['role' => CodeMartV1Constants::ROLE_REVIEWER, 'reason' => $reason, 'user_id' => $userId, 'admin_id' => $adminId]
            );
        }

        return [
            'id' => $application->id,
            'user_id' => $userId,
            'status' => CodeMartV1Constants::REVIEWER_APPLICATION_REVOKED,
            'reviewer_role_status' => $role?->fresh()?->role_status,
        ];
    }

    public function policy(): array
    {
        return [
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'deposit_amounts' => [
                CodeMartV1Constants::ROLE_CLIENT => CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_CLIENT),
                CodeMartV1Constants::ROLE_DEVELOPER => CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_DEVELOPER),
                CodeMartV1Constants::ROLE_ARCHITECT => CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_ARCHITECT),
                CodeMartV1Constants::ROLE_REVIEWER => CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_REVIEWER),
            ],
            'architect_additional_deposit' => CodeMartV1Constants::DEPOSIT_ARCHITECT_ADDITIONAL,
            'platform_commission_rate' => CodeMartV1Constants::PLATFORM_COMMISSION_RATE,
            'architect_thresholds' => [
                'min_projects' => CodeMartV1Constants::ARCHITECT_MIN_PROJECTS,
                'min_code_score' => CodeMartV1Constants::ARCHITECT_MIN_CODE_SCORE,
                'min_satisfaction' => CodeMartV1Constants::ARCHITECT_MIN_SATISFACTION,
            ],
            'reviewer_thresholds' => [
                'test_snippets' => CodeMartV1Constants::REVIEWER_TEST_SNIPPETS,
                'min_similarity' => CodeMartV1Constants::REVIEWER_MIN_SIMILARITY,
                'retry_days' => CodeMartV1Constants::REVIEWER_RETRY_DAYS,
            ],
            'role_status_transitions' => CodeMartV1Constants::ROLE_STATUS_TRANSITIONS,
            'role_status_reason_required' => CodeMartV1Constants::ROLE_STATUS_REASON_REQUIRED,
            'admin_project_target_statuses' => CodeMartV1Constants::ADMIN_PROJECT_TARGET_STATUSES,
            'max_kyc_image_size_kb' => CodeMartV1Constants::MAX_KYC_IMAGE_SIZE,
            'max_attachment_size_kb' => CodeMartV1Constants::MAX_ATTACHMENT_SIZE,
        ];
    }

    private static function serializeActivity(CodeMartV1ActivityModel $row, array $actors): array
    {
        return [
            'id' => $row->id,
            'actor_id' => $row->actor_id !== null ? (int) $row->actor_id : null,
            'actor' => $row->actor_id !== null ? ($actors[(int) $row->actor_id] ?? null) : null,
            'resource_type' => $row->resource_type,
            'resource_id' => (int) $row->resource_id,
            'action' => $row->action,
            'from_state' => $row->from_state,
            'to_state' => $row->to_state,
            'metadata' => $row->metadata,
            'created_at' => self::iso($row->created_at),
        ];
    }

    public function activityPage(array $filters, int $page, int $pageSize): array
    {
        $resourceType = (string) ($filters['resource_type'] ?? '');
        $resourceId = (int) ($filters['resource_id'] ?? 0);
        $actorId = (int) ($filters['actor_id'] ?? 0);
        $action = (string) ($filters['action'] ?? '');
        $search = (string) ($filters['search'] ?? '');

        $query = CodeMartV1ActivityModel::query();
        if ($resourceType !== '') {
            $query->where('resource_type', $resourceType);
        }
        if ($resourceId > 0) {
            $query->where('resource_id', $resourceId);
        }
        if ($actorId > 0) {
            $query->where('actor_id', $actorId);
        }
        if ($action !== '') {
            $query->where('action', $action);
        }
        self::applySearch($query, $search, ['action', 'resource_type']);
        $query->orderByDesc('id');

        $result = self::paginate($query, $page, $pageSize, 'items', static fn ($row) => $row);
        $actors = self::userSummaries(array_map(static fn ($row): int => (int) $row->actor_id, $result['items']));
        $result['items'] = array_map(
            static fn (CodeMartV1ActivityModel $row): array => self::serializeActivity($row, $actors),
            $result['items']
        );

        return $result;
    }

    public function contactMessagesPage(array $filters, int $page, int $pageSize): array
    {
        $status = (string) ($filters['status'] ?? '');
        $search = (string) ($filters['search'] ?? '');

        $query = CodeMartV1ContactMessageModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }
        self::applySearch($query, $search, ['name', 'email', 'subject', 'message']);
        $query->orderByDesc('id');

        return self::paginate($query, $page, $pageSize, 'items', static fn (CodeMartV1ContactMessageModel $row): array => [
            'id' => $row->id,
            'name' => $row->name,
            'email' => $row->email,
            'subject' => $row->subject,
            'message' => $row->message,
            'status' => $row->status,
            'handled_by' => $row->handled_by !== null ? (int) $row->handled_by : null,
            'handled_at' => self::iso($row->handled_at),
            'created_at' => self::iso($row->created_at),
        ]);
    }

    public function handleContactMessage(int $messageId, int $adminId): array
    {
        $message = CodeMartV1ContactMessageModel::findById($messageId);
        if (!$message) {
            return self::failure(CodeMartV1Constants::ERROR_CONTACT_MESSAGE_NOT_FOUND, 404, 'Contact message not found');
        }

        $fromStatus = (string) $message->status;
        if ($fromStatus !== CodeMartV1Constants::CONTACT_STATUS_HANDLED) {
            $message->update([
                'status' => CodeMartV1Constants::CONTACT_STATUS_HANDLED,
                'handled_by' => $adminId,
                'handled_at' => now(),
            ]);

            CodeMartV1DomainEventService::emit(
                $adminId,
                CodeMartV1Constants::RESOURCE_CONTACT_MESSAGE,
                (int) $message->id,
                'admin_contact_message_handled',
                $fromStatus,
                CodeMartV1Constants::CONTACT_STATUS_HANDLED,
                [],
                null,
                null,
                null,
                ['admin_id' => $adminId]
            );
        }

        return [
            'id' => $message->id,
            'status' => CodeMartV1Constants::CONTACT_STATUS_HANDLED,
            'handled_by' => (int) ($message->handled_by ?? $adminId),
        ];
    }

    private function forgetPublicHome(): void
    {
        app(CodeMartV1PublicHomeService::class)->forget();
    }
}
