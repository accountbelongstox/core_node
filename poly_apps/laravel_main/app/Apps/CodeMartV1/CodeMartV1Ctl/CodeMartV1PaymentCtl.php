<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1InvoiceModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WithdrawalModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceException;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1PaymentCtl extends Controller
{
    use ApiResponse;

    private function listResponse(array $result, string $key, int $page, int $pageSize): JsonResponse
    {
        $list = CodeMartV1FinanceService::pageResult($result, $key, $page, $pageSize);

        return $this->success($list + [
            'pageSize' => $list['page_size'],
            'totalPages' => $list['total_pages'],
        ]);
    }

    private function financeError(CodeMartV1FinanceException $e): JsonResponse
    {
        return $this->codedError($e->errorCode, $e->getMessage(), null, $e->httpStatus);
    }

    private function validationFailed($validator): JsonResponse
    {
        return $this->codedError('validation_failed', 'Validation failed', $validator->errors(), 422);
    }

    public function getWallet(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $wallet = CodeMartV1WalletModel::forUser((int) $user->id, true);

        return $this->success($wallet);
    }

    public function getWalletTransactions(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $wallet = CodeMartV1WalletModel::forUser((int) $user->id);

        if (!$wallet) {
            return $this->codedError('wallet_not_found', 'Wallet not found', null, 404);
        }

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);

        return $this->listResponse($wallet->transactionPage($page, $pageSize), 'transactions', $page, $pageSize);
    }

    /**
     * Wallet payments transfer directly payer -> payee under row locks (one
     * debit, one credit). Other methods create a pending record settled by
     * the gateway. A repeated Idempotency-Key returns the prior payment.
     */
    public function createPayment(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'payee_id' => 'required|integer|exists:users,id',
            'project_id' => 'nullable|exists:codemartv1.codemart_v1_projects,id',
            'milestone_id' => 'nullable|exists:codemartv1.codemart_v1_milestones,id',
            'amount' => 'required|numeric|min:0.01',
            'type' => 'required|in:milestone,hourly,bonus',
            'payment_method' => 'required|in:' . implode(',', CodeMartV1Constants::getAllPaymentMethods()),
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationFailed($validator);
        }

        $payerId = (int) $user->id;
        $payeeId = (int) $request->input('payee_id');
        if ($payerId === $payeeId) {
            return $this->codedError('payment_self_not_allowed', 'Payer and payee must differ', null, 422);
        }

        $amount = CodeMartV1FinanceService::money($request->input('amount'));
        $isWallet = $request->input('payment_method') === CodeMartV1Constants::PAYMENT_METHOD_WALLET;
        $idempotencyKey = CodeMartV1FinanceService::idempotencyKey($request);

        try {
            [$payment, $replayed] = CodeMartV1PaymentModel::runInTransaction(function () use ($request, $payerId, $payeeId, $amount, $isWallet, $idempotencyKey): array {
                $wallets = CodeMartV1WalletModel::lockForUsers([$payerId, $payeeId]);

                if ($idempotencyKey !== null) {
                    $prior = CodeMartV1PaymentModel::findByIdempotencyKey($payerId, $idempotencyKey);
                    if ($prior) {
                        return [$prior, true];
                    }
                }

                $payment = CodeMartV1PaymentModel::createRecord([
                    'payer_id' => $payerId,
                    'payee_id' => $payeeId,
                    'project_id' => $request->input('project_id'),
                    'milestone_id' => $request->input('milestone_id'),
                    'amount' => $amount,
                    'currency' => CodeMartV1Constants::DEFAULT_CURRENCY,
                    'type' => $request->input('type'),
                    'payment_method' => $request->input('payment_method'),
                    'description' => $request->input('description'),
                    'status' => $isWallet ? CodeMartV1Constants::PAYMENT_STATUS_COMPLETED : CodeMartV1Constants::PAYMENT_STATUS_PENDING,
                    'idempotency_key' => $idempotencyKey,
                ]);

                if ($isWallet) {
                    $meta = ['payment_id' => $payment->id];
                    if (!$wallets[$payerId]->debit($amount, CodeMartV1Constants::WALLET_TX_PAYMENT, "Payment {$payment->id} to user {$payeeId}", $meta)) {
                        throw new CodeMartV1FinanceException('insufficient_balance', 'Insufficient available wallet balance', 422);
                    }
                    $wallets[$payeeId]->credit($amount, CodeMartV1Constants::WALLET_TX_EARNING, "Payment {$payment->id} from user {$payerId}", $meta);
                }

                return [$payment, false];
            });
        } catch (CodeMartV1FinanceException $e) {
            return $this->financeError($e);
        }

        if (!$replayed) {
            CodeMartV1DomainEventService::emit(
                $payerId,
                'payment',
                (int) $payment->id,
                'payment_created',
                null,
                $payment->status,
                $payment->status === CodeMartV1Constants::PAYMENT_STATUS_COMPLETED ? [$payeeId] : [],
                CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                'notifications.paymentReceived',
                'notifications.paymentReceivedBody',
                ['amount' => (string) $payment->amount, 'payment_id' => (int) $payment->id]
            );
        }

        return $this->success(
            $payment->loadRecordRelations(['payer', 'payee'])->toArray() + ['idempotent_replay' => $replayed],
            'Payment created successfully',
            $replayed ? 200 : 201
        );
    }

    public function getPayment(Request $request, int $paymentId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $payment = CodeMartV1PaymentModel::findDetailed($paymentId);

        if (!$payment) {
            return $this->codedError('payment_not_found', 'Payment not found', null, 404);
        }

        if (!$payment->isParticipant((int) $user->id) && !AuthHelper::requireAdmin($request)) {
            return $this->codedError('payment_forbidden', 'You do not have access to this payment', null, 403);
        }

        return $this->success($payment);
    }

    public function getPayments(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);
        $result = CodeMartV1PaymentModel::userPage(
            (int) $user->id,
            $request->filled('status') ? (string) $request->status : null,
            $request->filled('type') ? (string) $request->type : null,
            $page,
            $pageSize
        );

        return $this->listResponse($result, 'payments', $page, $pageSize);
    }

    public function createInvoice(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|exists:codemartv1.codemart_v1_payments,id',
            'description' => 'nullable|string',
            'line_items' => 'nullable|array',
            'tax' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->validationFailed($validator);
        }

        $payment = CodeMartV1PaymentModel::findById((int) $request->payment_id);

        if (!$payment || (int) $payment->payee_id !== (int) $user->id) {
            return $this->codedError('invoice_forbidden', 'Only the payee can create an invoice for this payment', null, 403);
        }

        $tax = CodeMartV1FinanceService::money($request->tax ?? 0);
        $subtotal = CodeMartV1FinanceService::money($payment->amount);
        $total = bcadd($subtotal, $tax, 2);

        $invoice = CodeMartV1InvoiceModel::createRecord([
            'payment_id' => $request->payment_id,
            'invoice_number' => 'INV-' . now()->format('YmdHis') . '-' . $user->id,
            'issued_by' => $user->id,
            'description' => $request->description,
            'line_items' => $request->line_items,
            'subtotal' => $subtotal,
            'tax' => $tax,
            'total' => $total,
            'issued_date' => now()->toDateString(),
            'status' => CodeMartV1Constants::INVOICE_STATUS_SENT,
        ]);

        return $this->success($invoice->loadRecordRelations('payment'), 'Invoice created successfully', 201);
    }

    public function getInvoices(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);
        $result = CodeMartV1InvoiceModel::userPage(
            (int) $user->id,
            $request->filled('status') ? (string) $request->status : null,
            $page,
            $pageSize
        );

        return $this->listResponse($result, 'invoices', $page, $pageSize);
    }

    /**
     * Payer-only refund request on a completed or disputed payment with no
     * other open refund; the payment moves to disputed until an administrator
     * processes or rejects the refund.
     */
    public function requestRefund(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|integer',
            'reason' => 'required|string|max:2000',
            'notes' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return $this->validationFailed($validator);
        }

        $userId = (int) $user->id;
        $paymentId = (int) $request->input('payment_id');
        $idempotencyKey = CodeMartV1FinanceService::idempotencyKey($request);
        $fromState = null;

        try {
            [$refund, $replayed] = CodeMartV1FinanceService::idempotent(
                $userId,
                $idempotencyKey,
                fn (string $key) => CodeMartV1RefundModel::findByIdempotencyKey($userId, $key),
                function () use ($request, $userId, $paymentId, $idempotencyKey, &$fromState): CodeMartV1RefundModel {
                    $payment = CodeMartV1PaymentModel::lockById($paymentId);
                    if (!$payment) {
                        throw new CodeMartV1FinanceException('payment_not_found', 'Payment not found', 404);
                    }
                    if ((int) $payment->payer_id !== $userId) {
                        throw new CodeMartV1FinanceException('refund_forbidden_not_payer', 'Only the payer can request a refund', 403);
                    }
                    if (!in_array($payment->status, [
                        CodeMartV1Constants::PAYMENT_STATUS_COMPLETED,
                        CodeMartV1Constants::PAYMENT_STATUS_DISPUTED,
                    ], true)) {
                        throw new CodeMartV1FinanceException('refund_not_allowed_status', 'Payment is not refundable in its current status', 409);
                    }
                    if (CodeMartV1RefundModel::openForPayment((int) $payment->id)) {
                        throw new CodeMartV1FinanceException('refund_already_open', 'This payment already has an open refund', 409);
                    }

                    $fromState = $payment->status;
                    $refund = CodeMartV1RefundModel::createRecord([
                        'payment_id' => $payment->id,
                        'amount' => $payment->amount,
                        'reason' => $request->input('reason'),
                        'notes' => $request->input('notes'),
                        'requested_at' => now(),
                        'requested_by' => $userId,
                        'idempotency_key' => $idempotencyKey,
                        'status' => CodeMartV1Constants::REFUND_STATUS_PENDING,
                    ]);
                    $payment->update(['status' => CodeMartV1Constants::PAYMENT_STATUS_DISPUTED]);

                    return $refund;
                }
            );
        } catch (CodeMartV1FinanceException $e) {
            return $this->financeError($e);
        }

        if (!$replayed) {
            $payment = CodeMartV1PaymentModel::findById((int) $refund->payment_id);
            CodeMartV1DomainEventService::emit(
                $userId,
                'refund',
                (int) $refund->id,
                'refund_requested',
                null,
                CodeMartV1Constants::REFUND_STATUS_PENDING,
                $payment ? [(int) $payment->payee_id] : [],
                CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                'notifications.refundRequested',
                'notifications.refundRequestedBody',
                ['amount' => (string) $refund->amount, 'payment_id' => (int) $refund->payment_id, 'payment_from_state' => $fromState]
            );
        }

        return $this->success(
            $refund->toArray() + ['idempotent_replay' => $replayed],
            'Refund request created successfully',
            $replayed ? 200 : 201
        );
    }

    public function getRefunds(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);
        $result = CodeMartV1RefundModel::userPage(
            (int) $user->id,
            $request->filled('status') ? (string) $request->status : null,
            $page,
            $pageSize
        );

        return $this->listResponse($result, 'refunds', $page, $pageSize);
    }

    public function getWithdrawals(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = CodeMartV1FinanceService::pageParams($request);
        $result = CodeMartV1WithdrawalModel::userPage(
            (int) $user->id,
            $request->filled('status') ? (string) $request->status : null,
            $page,
            $pageSize
        );

        return $this->listResponse($result, 'withdrawals', $page, $pageSize);
    }

    /** Requesting a withdrawal freezes the amount until an administrator pays or rejects it. */
    public function requestWithdrawal(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:' . CodeMartV1Constants::WITHDRAWAL_MIN_AMOUNT,
            'method' => 'required|in:' . implode(',', CodeMartV1Constants::WITHDRAWAL_METHODS),
            'account_info' => 'required|array',
        ]);

        if ($validator->fails()) {
            return $this->validationFailed($validator);
        }

        $userId = (int) $user->id;
        $amount = CodeMartV1FinanceService::money($request->input('amount'));
        $idempotencyKey = CodeMartV1FinanceService::idempotencyKey($request);

        try {
            [$withdrawal, $replayed] = CodeMartV1FinanceService::idempotent(
                $userId,
                $idempotencyKey,
                fn (string $key) => CodeMartV1WithdrawalModel::findByIdempotencyKey($userId, $key),
                function () use ($request, $userId, $amount, $idempotencyKey): CodeMartV1WithdrawalModel {
                    $wallet = CodeMartV1WalletModel::lockForUser($userId);
                    $withdrawal = CodeMartV1WithdrawalModel::createRecord([
                        'user_id' => $userId,
                        'amount' => $amount,
                        'currency' => $wallet->currency ?: CodeMartV1Constants::DEFAULT_CURRENCY,
                        'status' => CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING,
                        'method' => $request->input('method'),
                        'account_info' => $request->input('account_info'),
                        'idempotency_key' => $idempotencyKey,
                    ]);

                    $ledger = $wallet->freeze(
                        $amount,
                        CodeMartV1Constants::WALLET_TX_WITHDRAWAL,
                        "Withdrawal {$withdrawal->id} requested",
                        ['withdrawal_id' => $withdrawal->id, 'phase' => 'freeze']
                    );
                    if (!$ledger) {
                        throw new CodeMartV1FinanceException('insufficient_balance', 'Insufficient available wallet balance', 422);
                    }

                    return $withdrawal;
                }
            );
        } catch (CodeMartV1FinanceException $e) {
            return $this->financeError($e);
        }

        if (!$replayed) {
            CodeMartV1DomainEventService::emit(
                $userId,
                'withdrawal',
                (int) $withdrawal->id,
                'withdrawal_requested',
                null,
                CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING,
                [],
                null,
                null,
                null,
                ['amount' => (string) $withdrawal->amount, 'method' => $withdrawal->method]
            );
        }

        return $this->success(
            $withdrawal->toArray() + ['idempotent_replay' => $replayed],
            'Withdrawal requested',
            $replayed ? 200 : 201
        );
    }
}
