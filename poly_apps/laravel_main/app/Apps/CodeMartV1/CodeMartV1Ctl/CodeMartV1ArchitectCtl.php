<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CodeMartV1ArchitectCtl extends Controller
{
    use ApiResponse;

    public function checkPromotionEligibility(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userRole = CodeMartV1UserRoleModel::where('user_id', $user->id)
            ->where('role_type', 'developer')
            ->first();

        if (!$userRole) {
            return $this->error('Only developers can apply for architect role');
        }

        if ($userRole->role_status === 'architect') {
            return $this->error('You are already an architect');
        }

        $stats = CodeMartV1DeveloperStatsModel::where('user_id', $user->id)->first();

        if (!$stats) {
            return $this->error('No developer statistics found');
        }

        $requirements = [
            'min_completed_projects' => 10,
            'min_avg_code_score' => 85,
            'min_client_satisfaction' => 4.5,
        ];

        $isEligible =
            $stats->completed_projects >= $requirements['min_completed_projects'] &&
            $stats->avg_code_score >= $requirements['min_avg_code_score'] &&
            $stats->avg_client_satisfaction >= $requirements['min_client_satisfaction'];

        return $this->success([
            'is_eligible' => $isEligible,
            'requirements' => $requirements,
            'current_stats' => [
                'completed_projects' => $stats->completed_projects,
                'avg_code_score' => $stats->avg_code_score,
                'avg_client_satisfaction' => $stats->avg_client_satisfaction,
            ],
            'shortfall' => [
                'completed_projects' => max(0, $requirements['min_completed_projects'] - $stats->completed_projects),
                'avg_code_score' => max(0, $requirements['min_avg_code_score'] - $stats->avg_code_score),
                'avg_client_satisfaction' => max(0, $requirements['min_client_satisfaction'] - $stats->avg_client_satisfaction),
            ],
        ]);
    }

    public function applyForArchitect(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userRole = CodeMartV1UserRoleModel::where('user_id', $user->id)
            ->where('role_type', 'developer')
            ->first();

        if (!$userRole) {
            return $this->error('Only developers can apply for architect role');
        }

        if ($userRole->role_status === 'architect') {
            return $this->error('You are already an architect');
        }

        $stats = CodeMartV1DeveloperStatsModel::where('user_id', $user->id)->first();

        if (!$stats ||
            $stats->completed_projects < 10 ||
            $stats->avg_code_score < 85 ||
            $stats->avg_client_satisfaction < 4.5) {
            return $this->error('You do not meet the requirements for architect promotion');
        }

        DB::beginTransaction();

        $userRole->update(['role_status' => 'architect_pending']);

        DB::commit();

        return $this->success([
            'message' => 'Architect application submitted. Please pay additional deposit to complete.',
            'required_deposit' => 10000,
        ]);
    }

    public function getArchitectTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userRole = CodeMartV1UserRoleModel::where('user_id', $user->id)
            ->where('role_status', 'architect')
            ->first();

        if (!$userRole) {
            return $this->forbidden('Only architects can access this endpoint');
        }

        $projects = DB::connection('CodeMartV1')
            ->table('codemart_v1_projects')
            ->where('architect_id', $user->id)
            ->orWhere('status', 'awaiting_architect')
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return $this->success([
            'assigned_projects' => $projects->where('architect_id', $user->id)->values(),
            'available_projects' => $projects->where('architect_id', null)->values(),
        ]);
    }

    public function acceptArchitectTask(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userRole = CodeMartV1UserRoleModel::where('user_id', $user->id)
            ->where('role_status', 'architect')
            ->first();

        if (!$userRole) {
            return $this->forbidden('Only architects can accept projects');
        }

        $project = DB::connection('CodeMartV1')
            ->table('codemart_v1_projects')
            ->where('id', $projectId)
            ->where('status', 'awaiting_architect')
            ->whereNull('architect_id')
            ->first();

        if (!$project) {
            return $this->notFound('Project not found or already assigned');
        }

        DB::connection('CodeMartV1')
            ->table('codemart_v1_projects')
            ->where('id', $projectId)
            ->update([
                'architect_id' => $user->id,
                'status' => 'in_progress',
                'updated_at' => now(),
            ]);

        return $this->success(['message' => 'Project accepted. You can now create tasks for developers.']);
    }

    public function completeArchitectDeposit(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userRole = CodeMartV1UserRoleModel::where('user_id', $user->id)
            ->where('role_status', 'architect_pending')
            ->first();

        if (!$userRole) {
            return $this->error('No pending architect application found');
        }

        $architectDeposit = CodeMartV1DepositModel::where('user_id', $user->id)
            ->where('role_type', 'architect')
            ->where('status', 'paid')
            ->sum('amount');

        if ($architectDeposit < 10000) {
            return $this->error('Insufficient architect deposit. Required: 10000, Current: ' . $architectDeposit);
        }

        DB::beginTransaction();

        $userRole->update(['role_status' => 'architect']);

        DB::commit();

        return $this->success(['message' => 'Congratulations! You are now an architect.']);
    }
}
