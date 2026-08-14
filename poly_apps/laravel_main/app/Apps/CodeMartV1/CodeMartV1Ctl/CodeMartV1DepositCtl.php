<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1DepositCtl extends Controller
{
    use ApiResponse;

    public function getDepositInfo(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userRole = CodeMartV1UserRoleModel::forUser((int) $user->id);
        if (!$userRole) {
            return $this->error('User role not found');
        }

        $requiredDeposit = match ($userRole->role_type) {
            'developer' => 5000,
            'client' => 0,
            default => 0,
        };

        $existingDeposit = CodeMartV1DepositModel::paidAmountForUser((int) $user->id);

        return $this->success([
            'required_deposit' => $requiredDeposit,
            'current_deposit' => $existingDeposit,
            'is_sufficient' => $existingDeposit >= $requiredDeposit,
            'shortfall' => max(0, $requiredDeposit - $existingDeposit),
        ]);
    }

    public function createDepositPayment(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:100',
            'payment_method' => 'required|in:alipay,wechat,bank_transfer',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $userRole = CodeMartV1UserRoleModel::forUser((int) $user->id);
        if (!$userRole) {
            return $this->error('User role not found');
        }

        CodeMartV1DepositModel::beginModelTransaction();

        $deposit = CodeMartV1DepositModel::createRecord([
            'user_id' => $user->id,
            'role_type' => $userRole->role_type,
            'amount' => $request->amount,
            'payment_method' => $request->payment_method,
            'status' => 'pending',
            'payment_url' => $this->generatePaymentUrl($request->payment_method, $request->amount),
        ]);

        CodeMartV1DepositModel::commitModelTransaction();

        return $this->success([
            'deposit_id' => $deposit->id,
            'amount' => $deposit->amount,
            'payment_url' => $deposit->payment_url,
            'status' => $deposit->status,
        ], 'Deposit payment created. Please complete payment.');
    }

    public function getDepositStatus(Request $request, $depositId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $deposit = CodeMartV1DepositModel::findOwned((int) $depositId, (int) $user->id);

        if (!$deposit) {
            return $this->notFound('Deposit not found');
        }

        return $this->success([
            'deposit_id' => $deposit->id,
            'amount' => $deposit->amount,
            'payment_method' => $deposit->payment_method,
            'status' => $deposit->status,
            'paid_at' => $deposit->paid_at,
        ]);
    }

    public function confirmDepositPayment(Request $request, $depositId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $deposit = CodeMartV1DepositModel::findOwned((int) $depositId, (int) $user->id, 'pending');

        if (!$deposit) {
            return $this->notFound('Deposit not found or already processed');
        }

        CodeMartV1DepositModel::beginModelTransaction();

        $deposit->updateRecord([
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        $userRole = CodeMartV1UserRoleModel::forUser((int) $user->id);
        if ($userRole && $userRole->role_status === 'pending_deposit') {
            $userRole->updateRecord(['role_status' => 'active']);
        }

        CodeMartV1DepositModel::commitModelTransaction();

        return $this->success([
            'deposit_id' => $deposit->id,
            'status' => $deposit->status,
            'role_status' => $userRole->role_status,
        ], 'Deposit confirmed. Your account is now active.');
    }

    public function getDepositHistory(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        return $this->success(CodeMartV1DepositModel::historyForUser((int) $user->id));
    }

    private function generatePaymentUrl(string $paymentMethod, float $amount): string
    {
        $orderId = 'DEP_' . time() . '_' . rand(1000, 9999);

        return match ($paymentMethod) {
            'alipay' => "https://openapi.alipay.com/gateway.do?order_id={$orderId}&amount={$amount}",
            'wechat' => "https://api.mch.weixin.qq.com/pay/unifiedorder?order_id={$orderId}&amount={$amount}",
            'bank_transfer' => "/api/codemart/v1/deposits/{$orderId}/bank-info",
            default => '',
        };
    }
}
