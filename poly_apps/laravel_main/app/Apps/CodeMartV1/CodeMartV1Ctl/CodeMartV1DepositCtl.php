<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * User-side deposits. A deposit becomes paid only through administrator
 * confirmation (or a gateway callback); users can never confirm their own.
 */
class CodeMartV1DepositCtl extends Controller
{
    use ApiResponse;

    /** Role rows the user holds or is applying for, excluding rejected ones. */
    private function depositRoles(int $userId): array
    {
        return CodeMartV1UserRoleModel::query()
            ->where('user_id', $userId)
            ->where('role_status', '!=', CodeMartV1Constants::ROLE_STATUS_REJECTED)
            ->orderBy('id')
            ->get()
            ->all();
    }

    private function roleSummary(int $userId, CodeMartV1UserRoleModel $role): array
    {
        return CodeMartV1DepositModel::policyForRole($userId, (string) $role->role_type) + [
            'role_status' => $role->role_status,
        ];
    }

    private function depositPayload(CodeMartV1DepositModel $deposit): array
    {
        return [
            'deposit_id' => $deposit->id,
            'role_type' => $deposit->role_type,
            'amount' => (string) $deposit->amount,
            'payment_method' => $deposit->payment_method,
            'payment_url' => $deposit->payment_url,
            'status' => $deposit->status,
            'paid_at' => $deposit->paid_at,
            'admin_notes' => $deposit->admin_notes,
        ];
    }

    public function getDepositInfo(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userId = (int) $user->id;
        $roles = array_map(fn (CodeMartV1UserRoleModel $role): array => $this->roleSummary($userId, $role), $this->depositRoles($userId));
        if ($roles === []) {
            return $this->codedError('role_not_found', 'User role not found', null, 404);
        }

        $primary = collect($roles)->first(fn (array $role): bool => (float) $role['required_amount'] > 0) ?? $roles[0];

        return $this->success([
            'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
            'roles' => $roles,
            'role_type' => $primary['role_type'],
            'required_deposit' => $primary['required_amount'],
            'current_deposit' => $primary['paid_amount'],
            'is_sufficient' => $primary['is_sufficient'],
            'shortfall' => $primary['remaining_amount'],
            'pending_amount' => CodeMartV1FinanceService::money(
                CodeMartV1DepositModel::query()
                    ->where('user_id', $userId)
                    ->where('status', CodeMartV1Constants::DEPOSIT_STATUS_PENDING)
                    ->sum('amount')
            ),
        ]);
    }

    public function createDepositPayment(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'role_type' => 'nullable|string|in:' . implode(',', CodeMartV1Constants::getAllRoles()),
            'amount' => 'nullable|numeric|min:0.01',
            'payment_method' => 'required|in:' . implode(',', CodeMartV1Constants::DEPOSIT_PAYMENT_METHODS),
        ]);

        if ($validator->fails()) {
            return $this->codedError('validation_failed', 'Validation failed', $validator->errors(), 422);
        }

        $userId = (int) $user->id;
        $policies = [];
        foreach ($this->depositRoles($userId) as $role) {
            $policies[$role->role_type] = CodeMartV1DepositModel::policyForRole($userId, (string) $role->role_type);
        }

        $roleType = $request->input('role_type');
        if ($roleType === null) {
            $roleType = collect($policies)->first(fn (array $policy): bool => !$policy['is_sufficient'])['role_type'] ?? null;
        }
        if ($roleType === null || !isset($policies[$roleType])) {
            return $this->codedError('deposit_role_not_allowed', 'Deposit role is not held or applied for by this user', null, 422);
        }

        $policy = $policies[$roleType];
        if ($policy['is_sufficient']) {
            return $this->codedError('deposit_not_required', 'Deposit requirement for this role is already satisfied', $policy, 409);
        }

        $remaining = $policy['remaining_amount'];
        $amount = $request->filled('amount') ? CodeMartV1FinanceService::money($request->input('amount')) : $remaining;
        $minimum = min((float) $remaining, (float) CodeMartV1Constants::DEPOSIT_MIN_AMOUNT);
        if ((float) $amount < $minimum || bccomp($amount, $remaining, 2) > 0) {
            return $this->codedError('deposit_amount_invalid', 'Deposit amount must be between the minimum and the remaining requirement', [
                'minimum' => CodeMartV1FinanceService::money($minimum),
                'remaining' => $remaining,
            ], 422);
        }

        $paymentMethod = (string) $request->input('payment_method');
        $idempotencyKey = CodeMartV1FinanceService::idempotencyKey($request);

        [$deposit, $replayed] = CodeMartV1FinanceService::idempotent(
            $userId,
            $idempotencyKey,
            fn (string $key) => CodeMartV1DepositModel::findByIdempotencyKey($userId, $key),
            function () use ($userId, $roleType, $amount, $paymentMethod, $idempotencyKey): CodeMartV1DepositModel {
                $deposit = CodeMartV1DepositModel::createRecord([
                    'user_id' => $userId,
                    'role_type' => $roleType,
                    'amount' => $amount,
                    'payment_method' => $paymentMethod,
                    'status' => CodeMartV1Constants::DEPOSIT_STATUS_PENDING,
                    'idempotency_key' => $idempotencyKey,
                ]);
                $deposit->updateRecord(['payment_url' => $this->generatePaymentUrl($deposit)]);

                return $deposit;
            }
        );

        if (!$replayed) {
            CodeMartV1DomainEventService::emit(
                $userId,
                'deposit',
                (int) $deposit->id,
                'deposit_created',
                null,
                CodeMartV1Constants::DEPOSIT_STATUS_PENDING,
                [],
                null,
                null,
                null,
                ['amount' => (string) $deposit->amount, 'role' => $deposit->role_type]
            );
        }

        return $this->success(
            $this->depositPayload($deposit) + ['idempotent_replay' => $replayed],
            'Deposit payment created. Awaiting administrator confirmation.',
            $replayed ? 200 : 201
        );
    }

    public function getDepositStatus(Request $request, $depositId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $deposit = CodeMartV1DepositModel::findOwned((int) $depositId, (int) $user->id);

        if (!$deposit) {
            return $this->codedError('deposit_not_found', 'Deposit not found', null, 404);
        }

        return $this->success($this->depositPayload($deposit));
    }

    public function getBankInfo(Request $request, $depositId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $deposit = CodeMartV1DepositModel::findOwned((int) $depositId, (int) $user->id);

        if (!$deposit) {
            return $this->codedError('deposit_not_found', 'Deposit not found', null, 404);
        }

        return $this->success([
            'deposit_id' => $deposit->id,
            'amount' => (string) $deposit->amount,
            'status' => $deposit->status,
            'reference' => CodeMartV1Constants::DEPOSIT_BANK_REFERENCE_PREFIX . $deposit->id,
            'bank' => CodeMartV1Constants::depositBankTransferInfo(),
        ]);
    }

    public function getDepositHistory(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        return $this->success(CodeMartV1DepositModel::historyForUser((int) $user->id));
    }

    private function generatePaymentUrl(CodeMartV1DepositModel $deposit): string
    {
        $orderId = CodeMartV1Constants::DEPOSIT_BANK_REFERENCE_PREFIX . $deposit->id;
        $amount = (string) $deposit->amount;

        return match ($deposit->payment_method) {
            'alipay' => "https://openapi.alipay.com/gateway.do?order_id={$orderId}&amount={$amount}",
            'wechat' => "https://api.mch.weixin.qq.com/pay/unifiedorder?order_id={$orderId}&amount={$amount}",
            'bank_transfer' => "/api/codemart/v1/deposits/{$deposit->id}/bank-info",
            default => '',
        };
    }
}
