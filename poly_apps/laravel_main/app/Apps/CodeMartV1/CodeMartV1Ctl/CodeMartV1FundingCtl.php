<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1EscrowService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceException;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1ProjectStateService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeMartV1FundingCtl extends Controller
{
    use ApiResponse;

    public function fundProject(Request $request, int $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        try {
            $result = CodeMartV1EscrowService::fundProject(
                $projectId,
                (int) $user->id,
                CodeMartV1FinanceService::idempotencyKey($request)
            );
        } catch (CodeMartV1FinanceException $e) {
            return $this->codedError($e->errorCode, $e->getMessage(), null, $e->httpStatus);
        }

        $escrow = $result['escrow'];
        $fundedProject = CodeMartV1ProjectModel::findById((int) $escrow->project_id);
        if ($fundedProject) {
            CodeMartV1ProjectStateService::openPendingTasks($fundedProject, (int) $user->id);
        }

        return $this->success([
            'project_id' => (int) $escrow->project_id,
            'project_status' => CodeMartV1ProjectModel::findById((int) $escrow->project_id)?->status,
            'escrow' => [
                'id' => (int) $escrow->id,
                'amount' => (string) $escrow->amount,
                'currency' => $escrow->currency,
                'status' => $escrow->status,
                'remaining_amount' => $escrow->remainingAmount(),
            ],
            'idempotent_replay' => $result['replayed'],
        ], 'Project funded', $result['replayed'] ? 200 : 201);
    }
}
