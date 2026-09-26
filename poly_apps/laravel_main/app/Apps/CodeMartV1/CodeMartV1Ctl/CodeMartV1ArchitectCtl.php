<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeMartV1ArchitectCtl extends Controller
{
    use ApiResponse;

    // Architect state lives on a dedicated role row (role_type = architect)
    // with the standard status vocabulary (pending/active/...), matching the
    // bootstrap capability derivation (getActiveRoles -> architect.read).
    // Legacy installs overloaded the developer row's role_status with
    // 'architect'/'architect_pending'; those markers are recognized here and
    // repaired into dedicated rows by the mutation endpoints.
    private const LEGACY_STATUS_ACTIVE = 'architect';
    private const LEGACY_STATUS_PENDING = 'architect_pending';
    private const ACTION_ARCHITECT_ASSIGNED = 'architect_assigned';

    private function architectRole(int $userId): ?CodeMartV1UserRoleModel
    {
        return CodeMartV1UserRoleModel::forUserAndType($userId, CodeMartV1Constants::ROLE_ARCHITECT);
    }

    private function developerRole(int $userId): ?CodeMartV1UserRoleModel
    {
        return CodeMartV1UserRoleModel::forUserAndType($userId, CodeMartV1Constants::ROLE_DEVELOPER);
    }

    private function legacyArchitectStatus(?CodeMartV1UserRoleModel $developerRole): ?string
    {
        if (!$developerRole) return null;
        return match ($developerRole->role_status) {
            self::LEGACY_STATUS_ACTIVE => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
            self::LEGACY_STATUS_PENDING => CodeMartV1Constants::ROLE_STATUS_PENDING,
            default => null,
        };
    }

    /** Effective architect status (null|pending|active|suspended|rejected). */
    private function architectStatus(int $userId): ?string
    {
        $architectRole = $this->architectRole($userId);
        if ($architectRole) return $architectRole->role_status;
        return $this->legacyArchitectStatus($this->developerRole($userId));
    }

    /** Repair a legacy developer-row marker into a dedicated architect row. */
    private function normalizeLegacyArchitect(int $userId): ?CodeMartV1UserRoleModel
    {
        $developerRole = $this->developerRole($userId);
        $legacyStatus = $this->legacyArchitectStatus($developerRole);
        if ($legacyStatus === null || !$developerRole) {
            return $this->architectRole($userId);
        }

        $architectRole = $this->architectRole($userId);
        if (!$architectRole) {
            $architectRole = CodeMartV1UserRoleModel::query()->create([
                'user_id' => $userId,
                'role_type' => CodeMartV1Constants::ROLE_ARCHITECT,
                'role_status' => $legacyStatus,
                'deposit_amount' => CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_ARCHITECT),
                'role_activated_at' => $legacyStatus === CodeMartV1Constants::ROLE_STATUS_ACTIVE ? now() : null,
            ]);
        }
        $developerRole->updateRecord(['role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE]);

        return $architectRole;
    }

    private function promotionRequirements(): array
    {
        return [
            'min_completed_projects' => CodeMartV1Constants::ARCHITECT_MIN_PROJECTS,
            'min_avg_code_score' => CodeMartV1Constants::ARCHITECT_MIN_CODE_SCORE,
            'min_client_satisfaction' => CodeMartV1Constants::ARCHITECT_MIN_SATISFACTION,
        ];
    }

    public function checkPromotionEligibility(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userId = (int) $user->id;
        $developerRole = $this->developerRole($userId);
        $architectStatus = $this->architectStatus($userId);
        $stats = CodeMartV1DeveloperStatsModel::forUser($userId);
        $requirements = $this->promotionRequirements();

        $currentStats = [
            'completed_projects' => (int) ($stats->completed_projects ?? 0),
            'avg_code_score' => (float) ($stats->avg_code_score ?? 0),
            'avg_client_satisfaction' => (float) ($stats->avg_client_satisfaction ?? 0),
        ];

        $isEligible = $architectStatus === null
            && $developerRole
            && $developerRole->role_status === CodeMartV1Constants::ROLE_STATUS_ACTIVE
            && $stats
            && $currentStats['completed_projects'] >= $requirements['min_completed_projects']
            && $currentStats['avg_code_score'] >= $requirements['min_avg_code_score']
            && $currentStats['avg_client_satisfaction'] >= $requirements['min_client_satisfaction'];

        $reason = null;
        if ($architectStatus === CodeMartV1Constants::ROLE_STATUS_ACTIVE) $reason = 'already_architect';
        elseif ($architectStatus !== null) $reason = 'application_' . $architectStatus;
        elseif (!$developerRole || $developerRole->role_status !== CodeMartV1Constants::ROLE_STATUS_ACTIVE) $reason = 'not_developer';
        elseif (!$isEligible) $reason = 'requirements_unmet';

        return $this->success([
            'is_eligible' => $isEligible,
            'is_architect' => $architectStatus === CodeMartV1Constants::ROLE_STATUS_ACTIVE,
            'architect_status' => $architectStatus,
            'reason' => $reason,
            'required_deposit' => CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_ARCHITECT),
            'requirements' => $requirements,
            'current_stats' => $currentStats,
            'shortfall' => [
                'completed_projects' => max(0, $requirements['min_completed_projects'] - $currentStats['completed_projects']),
                'avg_code_score' => max(0, $requirements['min_avg_code_score'] - $currentStats['avg_code_score']),
                'avg_client_satisfaction' => max(0, $requirements['min_client_satisfaction'] - $currentStats['avg_client_satisfaction']),
            ],
        ]);
    }

    public function applyForArchitect(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userId = (int) $user->id;
        $architectStatus = $this->architectStatus($userId);

        if ($architectStatus === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
            return $this->error('You are already an architect');
        }
        if ($architectStatus === CodeMartV1Constants::ROLE_STATUS_PENDING) {
            return $this->error('An architect application is already pending');
        }

        $developerRole = $this->developerRole($userId);
        if (!$developerRole || $developerRole->role_status !== CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
            return $this->error('Only active developers can apply for architect role');
        }

        $stats = CodeMartV1DeveloperStatsModel::forUser($userId);
        if (!$stats ||
            $stats->completed_projects < CodeMartV1Constants::ARCHITECT_MIN_PROJECTS ||
            $stats->avg_code_score < CodeMartV1Constants::ARCHITECT_MIN_CODE_SCORE ||
            $stats->avg_client_satisfaction < CodeMartV1Constants::ARCHITECT_MIN_SATISFACTION) {
            return $this->error('You do not meet the requirements for architect promotion');
        }

        $requiredDeposit = CodeMartV1Constants::getDepositAmount(CodeMartV1Constants::ROLE_ARCHITECT);
        CodeMartV1ProjectModel::runInTransaction(function () use ($userId, $requiredDeposit) {
            CodeMartV1UserRoleModel::query()->create([
                'user_id' => $userId,
                'role_type' => CodeMartV1Constants::ROLE_ARCHITECT,
                'role_status' => CodeMartV1Constants::ROLE_STATUS_PENDING,
                'deposit_amount' => $requiredDeposit,
                'role_activated_at' => null,
            ]);
        });

        return $this->success([
            'message' => 'Architect application submitted. Please pay additional deposit to complete.',
            'required_deposit' => $requiredDeposit,
            'deposit' => CodeMartV1DepositModel::policyForRole($userId, CodeMartV1Constants::ROLE_ARCHITECT),
        ]);
    }

    public function getArchitectTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $isArchitect = $this->architectStatus((int) $user->id) === CodeMartV1Constants::ROLE_STATUS_ACTIVE;
        if (!$isArchitect) {
            return $this->success([
                'is_architect' => false,
                'assigned_projects' => [],
                'available_projects' => [],
            ]);
        }

        $projects = CodeMartV1ProjectModel::architectProjects($user->id);

        return $this->success([
            'is_architect' => true,
            'assigned_projects' => $projects->where('architect_id', $user->id)->values(),
            'available_projects' => $projects->where('architect_id', null)->values(),
        ]);
    }

    public function acceptArchitectTask(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        if ($this->architectStatus((int) $user->id) !== CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
            return $this->forbidden('Only architects can accept projects');
        }

        if (!CodeMartV1ProjectModel::acceptForArchitect((int) $projectId, $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_NOT_FOUND, 'Project not found or already assigned', null, 404);
        }

        CodeMartV1DomainEventService::emit(
            (int) $user->id,
            CodeMartV1Constants::RESOURCE_PROJECT,
            (int) $projectId,
            self::ACTION_ARCHITECT_ASSIGNED,
            null,
            null,
            [],
            null,
            null,
            null,
            ['architect_id' => (int) $user->id]
        );

        return $this->success(['message' => 'Project accepted. You can now create tasks for developers.']);
    }

    public function completeArchitectDeposit(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userId = (int) $user->id;
        $architectRole = $this->normalizeLegacyArchitect($userId);
        $policy = CodeMartV1DepositModel::policyForRole($userId, CodeMartV1Constants::ROLE_ARCHITECT);

        if (!$architectRole) {
            return $this->codedError('architect_application_missing', 'No architect application found', $policy, 404);
        }
        if ($architectRole->role_status === CodeMartV1Constants::ROLE_STATUS_ACTIVE) {
            return $this->success(['role_status' => $architectRole->role_status, 'deposit' => $policy, 'activated' => false]);
        }
        if ($architectRole->role_status !== CodeMartV1Constants::ROLE_STATUS_PENDING) {
            return $this->codedError('architect_application_invalid_state', 'Architect application is not pending', $policy, 409);
        }

        // Only an administrator-confirmed (paid) architect-role deposit counts; users cannot self-confirm.
        if (CodeMartV1DepositModel::paidAmountForUser($userId, CodeMartV1Constants::ROLE_ARCHITECT) <= 0) {
            return $this->codedError('architect_deposit_not_confirmed', 'No administrator-confirmed architect deposit found', $policy, 409);
        }
        if (!$policy['is_sufficient']) {
            return $this->codedError('architect_deposit_insufficient', 'Confirmed deposits do not cover the architect requirement', $policy, 409);
        }

        CodeMartV1ProjectModel::runInTransaction(function () use ($architectRole) {
            $architectRole->updateRecord([
                'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                'role_activated_at' => now(),
            ]);
        });

        CodeMartV1DomainEventService::emit(
            $userId,
            'role',
            $userId,
            'architect_activated',
            CodeMartV1Constants::ROLE_STATUS_PENDING,
            CodeMartV1Constants::ROLE_STATUS_ACTIVE,
            [],
            null,
            null,
            null,
            ['role' => CodeMartV1Constants::ROLE_ARCHITECT, 'paid_amount' => $policy['paid_amount']]
        );

        return $this->success([
            'role_status' => CodeMartV1Constants::ROLE_STATUS_ACTIVE,
            'deposit' => $policy,
            'activated' => true,
        ]);
    }
}
