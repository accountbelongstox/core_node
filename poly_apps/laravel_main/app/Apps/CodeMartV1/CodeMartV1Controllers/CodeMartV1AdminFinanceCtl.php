<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminFinanceService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceException;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * CodeMart finance administration: refunds, deposits, withdrawals, payments,
 * escrows and disputes. Authorization reuses the global Laravel administrator
 * policy (AuthHelper::requireAdmin).
 */
class CodeMartV1AdminFinanceCtl extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CodeMartV1AdminFinanceService $financeService)
    {
    }

    private function notes(Request $request): ?string
    {
        $notes = trim((string) $request->input('notes', ''));

        return $notes === '' ? null : $notes;
    }

    private function financeError(CodeMartV1FinanceException $e): JsonResponse
    {
        return $this->codedError($e->errorCode, $e->getMessage(), null, $e->httpStatus);
    }

    /** Runs an admin mutation with admin check, optional notes validation and finance error mapping. */
    private function adminAction(Request $request, callable $action, string $message, bool $notesRequired = false): JsonResponse
    {
        $admin = AuthHelper::requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'notes' => ($notesRequired ? 'required' : 'nullable') . '|string|max:2000',
        ]);
        if ($validator->fails()) {
            return $this->codedError('validation_failed', 'Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $action((int) $admin->id, $this->notes($request));
        } catch (CodeMartV1FinanceException $e) {
            return $this->financeError($e);
        }

        return $this->success($result, $message);
    }

    public function approveRefund(Request $request, int $refundId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->approveRefund($refundId, $adminId, $notes),
            'Refund approved'
        );
    }

    public function rejectRefund(Request $request, int $refundId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->rejectRefund($refundId, $adminId, $notes),
            'Refund rejected',
            true
        );
    }

    public function processRefund(Request $request, int $refundId): JsonResponse
    {
        return $this->adminAction(
            $request,
            function (int $adminId, ?string $notes) use ($refundId): array {
                $result = $this->financeService->processRefund($refundId, $adminId, $notes);

                return [
                    'refund' => $result['refund'],
                    'payment_id' => (int) $result['payment']->id,
                    'payment_status' => $result['payment']->status,
                    'source' => $result['source'],
                    'idempotent_replay' => $result['replayed'],
                ];
            },
            'Refund processed'
        );
    }

    public function rejectDeposit(Request $request, int $depositId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->rejectDeposit($depositId, $adminId, $notes),
            'Deposit rejected',
            true
        );
    }

    public function refundDeposit(Request $request, int $depositId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->refundDeposit($depositId, $adminId, $notes),
            'Deposit refunded'
        );
    }

    public function withdrawals(Request $request): JsonResponse
    {
        if (!AuthHelper::requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);
        $status = trim((string) $request->query('status', ''));

        return $this->success($this->financeService->withdrawalsPage($status, $page, $pageSize));
    }

    public function approveWithdrawal(Request $request, int $withdrawalId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->approveWithdrawal($withdrawalId, $adminId, $notes),
            'Withdrawal approved'
        );
    }

    public function rejectWithdrawal(Request $request, int $withdrawalId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->rejectWithdrawal($withdrawalId, $adminId, $notes),
            'Withdrawal rejected',
            true
        );
    }

    public function payWithdrawal(Request $request, int $withdrawalId): JsonResponse
    {
        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->payWithdrawal($withdrawalId, $adminId, $notes),
            'Withdrawal marked as paid'
        );
    }

    public function payments(Request $request): JsonResponse
    {
        if (!AuthHelper::requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);

        return $this->success($this->financeService->paymentsPage(
            trim((string) $request->query('status', '')),
            trim((string) $request->query('type', '')),
            $page,
            $pageSize
        ));
    }

    public function escrows(Request $request): JsonResponse
    {
        if (!AuthHelper::requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);
        $projectId = $request->query('project_id');

        return $this->success($this->financeService->escrowsPage(
            trim((string) $request->query('status', '')),
            $projectId !== null && $projectId !== '' ? (int) $projectId : null,
            $page,
            $pageSize
        ));
    }

    public function resolveDispute(Request $request, int $paymentId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'resolution' => 'required|in:' . CodeMartV1Constants::DISPUTE_RESOLUTION_REFUND . ',' . CodeMartV1Constants::DISPUTE_RESOLUTION_COMPLETE,
        ]);
        if ($validator->fails() && AuthHelper::requireAdmin($request)) {
            return $this->codedError('validation_failed', 'Validation failed', $validator->errors(), 422);
        }

        return $this->adminAction(
            $request,
            fn (int $adminId, ?string $notes) => $this->financeService->resolveDispute(
                $paymentId,
                (string) $request->input('resolution'),
                $adminId,
                $notes
            ),
            'Dispute resolved'
        );
    }
}
