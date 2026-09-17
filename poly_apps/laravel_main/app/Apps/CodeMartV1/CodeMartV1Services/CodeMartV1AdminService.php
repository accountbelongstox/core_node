<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1KycVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1NotificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;

/**
 * Platform-administration operations for CodeMart. Every method requires the
 * caller to have passed the global Laravel administrator check in the
 * controller; CodeMart role membership never grants admin rights.
 */
class CodeMartV1AdminService
{
    public function overview(): array
    {
        $projectsByStatus = CodeMartV1ProjectModel::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        return [
            'users_total' => CodeMartV1UserModel::query()->count(),
            'codeMart_role_holders' => CodeMartV1UserRoleModel::query()->distinct()->count('user_id'),
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
                ->where('status', 'pending')
                ->count(),
        ];
    }

    public function usersPage(string $search, int $page, int $pageSize): array
    {
        $query = CodeMartV1UserModel::query()->with('userRoles');

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder->where('username', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('name', 'like', '%' . $search . '%');
            });
        }

        return [
            'total' => (clone $query)->count(),
            'users' => $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(
                static fn (CodeMartV1UserModel $user): array => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'name' => $user->name,
                    'rolelevel' => (int) $user->rolelevel,
                    'rolename' => $user->rolename,
                    'roles' => $user->roleStatusMap(),
                    'created_at' => $user->created_at?->toIso8601String(),
                ]
            )->all(),
        ];
    }

    public function setRoleStatus(int $userId, string $roleType, string $status, int $adminId): ?array
    {
        if (!in_array($status, [
            CodeMartV1Constants::ROLE_STATUS_ACTIVE,
            CodeMartV1Constants::ROLE_STATUS_SUSPENDED,
            CodeMartV1Constants::ROLE_STATUS_REJECTED,
            CodeMartV1Constants::ROLE_STATUS_PENDING,
        ], true)) {
            return null;
        }

        $role = CodeMartV1UserRoleModel::forUserAndType($userId, $roleType);
        if (!$role) {
            return null;
        }

        $attributes = ['role_status' => $status];
        if ($status === CodeMartV1Constants::ROLE_STATUS_ACTIVE && $role->role_activated_at === null) {
            $attributes['role_activated_at'] = now();
        }
        $role->update($attributes);

        CodeMartV1NotificationModel::createRecord([
            'user_id' => $userId,
            'type' => CodeMartV1Constants::NOTIFICATION_TYPE_ADMIN,
            'title_key' => 'notifications.roleStatusChanged',
            'body_key' => 'notifications.roleStatusChangedBody',
            'params' => ['role' => $roleType, 'status' => $status],
            'resource_type' => 'user_role',
            'resource_id' => $role->id,
        ]);

        return [
            'user_id' => $userId,
            'role_type' => $roleType,
            'role_status' => $status,
        ];
    }

    public function kycPage(string $status, int $page, int $pageSize): array
    {
        $query = CodeMartV1KycVerificationModel::query();
        if ($status !== '') {
            $query->where('verification_status', $status);
        }

        return [
            'total' => (clone $query)->count(),
            'items' => $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(
                static fn (CodeMartV1KycVerificationModel $kyc): array => [
                    'id' => $kyc->id,
                    'user_id' => $kyc->user_id,
                    'identity_type' => $kyc->identity_type,
                    'real_name' => $kyc->real_name,
                    'verification_status' => $kyc->verification_status,
                    'verification_notes' => $kyc->verification_notes,
                    'submitted_at' => $kyc->created_at?->toIso8601String(),
                ]
            )->all(),
        ];
    }

    public function reviewKyc(int $kycId, bool $approved, ?string $notes, int $adminId): ?array
    {
        $kyc = CodeMartV1KycVerificationModel::findById($kycId);
        if (!$kyc) {
            return null;
        }

        $status = $approved
            ? CodeMartV1Constants::KYC_STATUS_APPROVED
            : CodeMartV1Constants::KYC_STATUS_REJECTED;

        $kyc->update([
            'verification_status' => $status,
            'verification_notes' => $notes,
            'verified_at' => now(),
            'verified_by' => (string) $adminId,
        ]);

        CodeMartV1NotificationModel::createRecord([
            'user_id' => $kyc->user_id,
            'type' => CodeMartV1Constants::NOTIFICATION_TYPE_ONBOARDING,
            'title_key' => $approved ? 'notifications.kycApproved' : 'notifications.kycRejected',
            'body_key' => $approved ? 'notifications.kycApprovedBody' : 'notifications.kycRejectedBody',
            'params' => ['notes' => $notes],
            'resource_type' => 'kyc',
            'resource_id' => $kyc->id,
        ]);

        return [
            'id' => $kyc->id,
            'verification_status' => $status,
        ];
    }

    public function refundsPage(string $status, int $page, int $pageSize): array
    {
        $query = CodeMartV1RefundModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }

        return [
            'total' => (clone $query)->count(),
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
            'items' => $query->orderByDesc('id')->forPage($page, $pageSize)->get(),
        ];
    }

    /**
     * Confirm a deposit payment and activate the matching role atomically.
     * Re-running with an already-confirmed deposit returns the same result.
     */
    public function confirmDeposit(int $depositId, int $adminId): ?array
    {
        $deposit = CodeMartV1DepositModel::findById($depositId);
        if (!$deposit) {
            return null;
        }

        if ($deposit->status === 'paid') {
            return [
                'id' => $deposit->id,
                'status' => $deposit->status,
                'role_activated' => true,
                'idempotent_replay' => true,
            ];
        }

        CodeMartV1DepositModel::runInTransaction(function () use ($deposit): void {
            $locked = CodeMartV1DepositModel::query()
                ->whereKey($deposit->id)
                ->lockForUpdate()
                ->first();

            if ($locked->status === 'paid') {
                return;
            }

            $locked->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);

            $role = CodeMartV1UserRoleModel::forUserAndType($locked->user_id, $locked->role_type);
            if ($role && in_array($role->role_status, [
                CodeMartV1Constants::ROLE_STATUS_PENDING,
                'pending_deposit',
            ], true)) {
                $role->update([
                    'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                    'role_activated_at' => now(),
                    'deposit_amount' => $locked->amount,
                ]);
            }
        });

        $fresh = CodeMartV1DepositModel::findById($depositId);

        CodeMartV1NotificationModel::createRecord([
            'user_id' => $fresh->user_id,
            'type' => CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            'title_key' => 'notifications.depositConfirmed',
            'body_key' => 'notifications.depositConfirmedBody',
            'params' => ['amount' => (string) $fresh->amount, 'role' => $fresh->role_type],
            'resource_type' => 'deposit',
            'resource_id' => $fresh->id,
        ]);

        return [
            'id' => $fresh->id,
            'status' => $fresh->status,
            'role_activated' => true,
            'idempotent_replay' => false,
        ];
    }

    public function projectsPage(string $status, int $page, int $pageSize): array
    {
        $query = CodeMartV1ProjectModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }

        return [
            'total' => (clone $query)->count(),
            'items' => $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(
                static fn (CodeMartV1ProjectModel $project): array => [
                    'id' => $project->id,
                    'client_id' => $project->client_id,
                    'title' => $project->title,
                    'status' => $project->status,
                    'budget' => $project->budget !== null ? (string) $project->budget : null,
                    'currency' => $project->currency,
                    'created_at' => $project->created_at?->toIso8601String(),
                ]
            )->all(),
        ];
    }
}
