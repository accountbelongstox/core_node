<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ClientProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1NotificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;

/**
 * Builds the versioned CodeMart bootstrap projection: user, roles,
 * capabilities, onboarding truth, contract vocabulary, policy, and counters.
 * The UI derives every visibility and state label from this payload and never
 * duplicates server policy locally.
 */
class CodeMartV1BootstrapService
{
    public function buildForUser(int $userId): ?array
    {
        $user = CodeMartV1UserModel::findRegistration($userId);
        if (!$user) {
            return null;
        }

        $roleStatusMap = $user->roleStatusMap();
        $activeRoles = $user->getActiveRoles();
        $isAdmin = $user->rolelevel >= 10;
        $requestableRoles = $this->requestableRoles($roleStatusMap);
        $capabilities = $this->deriveCapabilities(
            $activeRoles,
            $isAdmin,
            $requestableRoles !== [],
            CodeMartV1TestimonialService::isEligible($userId)
        );

        return [
            'contract_version' => CodeMartV1Constants::CONTRACT_VERSION,
            'min_supported_ui_version' => CodeMartV1Constants::MIN_SUPPORTED_UI_VERSION,
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'name' => $user->name,
                'nickname' => $user->nickname,
                'rolelevel' => (int) $user->rolelevel,
                'rolename' => $user->rolename,
            ],
            'is_admin' => $isAdmin,
            'is_super_admin' => $user->rolelevel >= 100,
            'roles' => $roleStatusMap,
            'capabilities' => $capabilities,
            'onboarding' => $this->buildOnboarding($user, $roleStatusMap, $requestableRoles),
            'profile' => $this->buildProfile($user),
            'vocabulary' => CodeMartV1Constants::contractVocabulary(),
            'counters' => $this->buildCounters($userId, $activeRoles, $isAdmin),
        ];
    }

    /**
     * Self-service roles the user may still request (never held, or rejected).
     */
    private function requestableRoles(array $roleStatusMap): array
    {
        $requestable = [];
        foreach (CodeMartV1RoleRequestService::SELF_SERVICE_ROLES as $roleType) {
            $status = $roleStatusMap[$roleType] ?? null;
            if ($status === null || $status === CodeMartV1Constants::ROLE_STATUS_REJECTED) {
                $requestable[] = $roleType;
            }
        }

        return $requestable;
    }

    private function deriveCapabilities(
        array $activeRoles,
        bool $isAdmin,
        bool $canRequestRole = false,
        bool $canCreateTestimonial = false
    ): array {
        $capabilities = [
            CodeMartV1Constants::CAPABILITY_ONBOARDING_READ,
            CodeMartV1Constants::CAPABILITY_PROFILE_READ,
            CodeMartV1Constants::CAPABILITY_NOTIFICATION_READ,
            CodeMartV1Constants::CAPABILITY_PROJECT_READ,
        ];

        if ($canRequestRole) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_ROLE_REQUEST;
        }

        if ($canCreateTestimonial) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TESTIMONIAL_CREATE;
        }

        if (in_array(CodeMartV1Constants::ROLE_CLIENT, $activeRoles, true)) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_PROJECT_CREATE;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_FINANCE_READ;
        }

        if (in_array(CodeMartV1Constants::ROLE_DEVELOPER, $activeRoles, true)) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TASK_BROWSE;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TASK_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_FINANCE_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_FINANCE_WITHDRAW;
        }

        if (in_array(CodeMartV1Constants::ROLE_ARCHITECT, $activeRoles, true)) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_ARCHITECT_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TASK_BROWSE;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TASK_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_FINANCE_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_FINANCE_WITHDRAW;
        }

        if (in_array(CodeMartV1Constants::ROLE_REVIEWER, $activeRoles, true)) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_REVIEW_READ;
        }

        if ($isAdmin) {
            $capabilities[] = CodeMartV1Constants::CAPABILITY_ADMIN_ACCESS;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TASK_BROWSE;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_TASK_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_REVIEW_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_ARCHITECT_READ;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_PROJECT_CREATE;
            $capabilities[] = CodeMartV1Constants::CAPABILITY_FINANCE_READ;
        }

        return array_values(array_unique($capabilities));
    }

    /**
     * Explicit onboarding steps with completion and next-step truth. The UI
     * never derives onboarding state from missing fields.
     */
    private function buildOnboarding(CodeMartV1UserModel $user, array $roleStatusMap, array $requestableRoles = []): array
    {
        $emailVerified = $user->email_verified_at !== null || !empty($user->email);
        $phoneVerified = $user->hasVerifiedPhone();
        $kycStatus = $user->kycVerification?->verification_status
            ?? CodeMartV1Constants::KYC_STATUS_NOT_STARTED;
        $kycApproved = $kycStatus === CodeMartV1Constants::KYC_STATUS_APPROVED;

        $activeRoles = [];
        $pendingRoles = [];
        foreach ($roleStatusMap as $roleType => $roleStatus) {
            if ($roleStatus === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
                $activeRoles[] = $roleType;
            } elseif ($roleStatus === CodeMartV1Constants::ROLE_STATUS_PENDING) {
                $pendingRoles[] = $roleType;
            }
        }

        $depositRequired = [];
        foreach ($pendingRoles as $roleType) {
            $amount = CodeMartV1Constants::getDepositAmount($roleType);
            if ($amount > 0) {
                $depositRequired[$roleType] = $amount;
            }
        }

        $steps = [
            [
                'key' => 'account',
                'completed' => true,
                'blocked' => false,
            ],
            [
                'key' => 'role_request',
                'completed' => $roleStatusMap !== [],
                'blocked' => false,
                'requestable_roles' => $requestableRoles,
            ],
            [
                'key' => 'phone_verification',
                'completed' => $phoneVerified,
                'blocked' => false,
            ],
            [
                'key' => 'kyc',
                'completed' => $kycApproved,
                'blocked' => $kycStatus === CodeMartV1Constants::KYC_STATUS_REJECTED,
            ],
            [
                'key' => 'deposit',
                'completed' => $pendingRoles === [] || $depositRequired === [],
                'blocked' => false,
            ],
            [
                'key' => 'role_active',
                'completed' => $activeRoles !== [],
                'blocked' => false,
            ],
        ];

        $nextStep = null;
        foreach ($steps as $step) {
            if (!$step['completed'] && !$step['blocked']) {
                $nextStep = $step['key'];
                break;
            }
        }

        return [
            'email_verified' => $emailVerified,
            'phone_verified' => $phoneVerified,
            'kyc_status' => $kycStatus,
            'deposit_required' => $depositRequired,
            'requestable_roles' => $requestableRoles,
            'steps' => $steps,
            'next_step' => $nextStep,
            'complete' => $nextStep === null,
        ];
    }

    private function buildProfile(CodeMartV1UserModel $user): array
    {
        $developerProfile = CodeMartV1DeveloperProfileModel::query()
            ->where('user_id', $user->id)
            ->first();
        $clientProfile = CodeMartV1ClientProfileModel::query()
            ->where('user_id', $user->id)
            ->first();

        return [
            'developer' => $developerProfile ? [
                'company_name' => $developerProfile->company_name,
                'bio' => $developerProfile->bio,
                'skills' => $developerProfile->skills,
                'certifications' => $developerProfile->certifications,
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
        ];
    }

    private function buildCounters(int $userId, array $activeRoles, bool $isAdmin): array
    {
        $activeProjects = CodeMartV1ProjectModel::query()
            ->where('client_id', $userId)
            ->whereIn('status', [
                CodeMartV1Constants::PROJECT_STATUS_OPEN,
                CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS,
                CodeMartV1Constants::PROJECT_STATUS_PAUSED,
            ])
            ->count();

        $myTasks = CodeMartV1TaskModel::query()
            ->where('assigned_to', $userId)
            ->whereIn('status', [
                CodeMartV1Constants::TASK_STATUS_ASSIGNED,
                CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
                CodeMartV1Constants::TASK_STATUS_BLOCKED,
                CodeMartV1Constants::TASK_STATUS_REVIEW,
            ])
            ->count();

        $openMarketplaceTasks = CodeMartV1TaskModel::query()
            ->where('status', CodeMartV1Constants::TASK_STATUS_OPEN)
            ->whereNull('assigned_to')
            ->count();

        $pendingReviews = CodeMartV1CodeReviewModel::query()
            ->where('reviewer_id', $userId)
            ->where('status', CodeMartV1Constants::SUBMISSION_STATUS_PENDING)
            ->count();

        $wallet = CodeMartV1WalletModel::query()->where('user_id', $userId)->first();
        $protectedFunds = CodeMartV1EscrowModel::sumRemaining(
            CodeMartV1EscrowModel::query()
                ->where(function ($query) use ($userId): void {
                    $query->where('payer_id', $userId)->orWhere('payee_id', $userId);
                })
                ->whereIn('status', [
                    CodeMartV1Constants::ESCROW_STATUS_HELD,
                    CodeMartV1Constants::ESCROW_STATUS_DISPUTED,
                ])
        );

        return [
            'active_projects' => $activeProjects,
            'my_open_tasks' => $myTasks,
            'open_marketplace_tasks' => $openMarketplaceTasks,
            'pending_reviews' => $pendingReviews,
            'protected_funds' => number_format((float) $protectedFunds, 2, '.', ''),
            'wallet_balance' => $wallet ? (string) $wallet->balance : '0.00',
            'currency' => $wallet?->currency ?? CodeMartV1Constants::DEFAULT_CURRENCY,
            'unread_notifications' => CodeMartV1NotificationModel::unreadCountForUser($userId),
        ];
    }
}
