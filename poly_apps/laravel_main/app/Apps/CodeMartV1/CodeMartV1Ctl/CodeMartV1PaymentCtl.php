<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1InvoiceModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1PaymentCtl extends Controller
{
    use ApiResponse;

    public function getWallet(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $wallet = CodeMartV1WalletModel::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'available_balance' => 0, 'frozen_balance' => 0]
        );

        return $this->success($wallet);
    }

    public function getWalletTransactions(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $wallet = CodeMartV1WalletModel::where('user_id', $user->id)->first();

        if (!$wallet) {
            return $this->notFound('Wallet not found');
        }

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $total = $wallet->transactions()->count();
        $transactions = $wallet->transactions()
            ->orderBy('created_at', 'desc')
            ->paginate($pageSize, ['*'], 'page', $page);

        return $this->success([
            'items' => $transactions->items(),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'totalPages' => ceil($total / $pageSize),
        ]);
    }

    public function createPayment(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'payee_id' => 'required|exists:users,id',
            'project_id' => 'nullable|exists:codemart_projects,id',
            'milestone_id' => 'nullable|exists:codemart_milestones,id',
            'amount' => 'required|numeric|min:0.01',
            'type' => 'required|in:milestone,hourly,refund,bonus',
            'payment_method' => 'required|in:wallet,credit_card,bank_transfer,alipay,wechat',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        CodeMartV1PaymentModel::beginModelTransaction();

        $payer_wallet = CodeMartV1WalletModel::where('user_id', $user->id)->first();

        if ($request->payment_method === 'wallet') {
            if (!$payer_wallet || $payer_wallet->available_balance < $request->amount) {
                CodeMartV1PaymentModel::rollBackModelTransaction();
                return $this->error('Insufficient wallet balance', 422);
            }

            $payer_wallet->holdFunds($request->amount, "Payment hold for " . ($request->description ?? "project payment"));
        }

        $payment = CodeMartV1PaymentModel::create([
            'payer_id' => $user->id,
            'payee_id' => $request->payee_id,
            'project_id' => $request->project_id,
            'milestone_id' => $request->milestone_id,
            'amount' => $request->amount,
            'currency' => 'CNY',
            'type' => $request->type,
            'payment_method' => $request->payment_method,
            'description' => $request->description,
            'status' => $request->payment_method === 'wallet' ? 'completed' : 'pending',
        ]);

        if ($request->payment_method === 'wallet' && $payment->status === 'completed') {
            $payer_wallet->withdrawal($request->amount, "Payment to user {$request->payee_id}");
            $payee_wallet = CodeMartV1WalletModel::firstOrCreate(
                ['user_id' => $request->payee_id],
                ['balance' => 0, 'available_balance' => 0, 'frozen_balance' => 0]
            );
            $payee_wallet->deposit($request->amount, "Payment from user {$user->id}");
        }

        CodeMartV1PaymentModel::commitModelTransaction();

        return $this->success($payment->load(['payer', 'payee']), 'Payment created successfully', 201);
    }

    public function getPayment(Request $request, int $paymentId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $payment = CodeMartV1PaymentModel::with([
            'payer',
            'payee',
            'invoice',
            'refund',
        ])->find($paymentId);

        if (!$payment) {
            return $this->notFound('Payment not found');
        }

        return $this->success($payment);
    }

    public function getPayments(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $query = CodeMartV1PaymentModel::query()
            ->where(function ($q) use ($user) {
                $q->where('payer_id', $user->id)->orWhere('payee_id', $user->id);
            });

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $total = $query->count();
        $payments = $query->orderBy('created_at', 'desc')
            ->paginate($pageSize, ['*'], 'page', $page);

        return $this->success([
            'items' => $payments->items(),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'totalPages' => ceil($total / $pageSize),
        ]);
    }

    public function createInvoice(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|exists:codemart_payments,id',
            'description' => 'nullable|string',
            'line_items' => 'nullable|array',
            'tax' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $payment = CodeMartV1PaymentModel::find($request->payment_id);

        if (!$payment || $payment->payee_id !== $user->id) {
            return $this->forbidden('You do not have permission to create invoice for this payment');
        }

        $tax = $request->tax ?? 0;
        $subtotal = $payment->amount;
        $total = $subtotal + $tax;

        $invoice = CodeMartV1InvoiceModel::create([
            'payment_id' => $request->payment_id,
            'invoice_number' => 'INV-' . now()->format('YmdHis') . '-' . $user->id,
            'issued_by' => $user->id,
            'description' => $request->description,
            'line_items' => $request->line_items,
            'subtotal' => $subtotal,
            'tax' => $tax,
            'total' => $total,
            'issued_date' => now()->toDateString(),
            'status' => 'sent',
        ]);

        return $this->success($invoice->load('payment'), 'Invoice created successfully', 201);
    }

    public function requestRefund(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|exists:codemart_payments,id',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $payment = CodeMartV1PaymentModel::find($request->payment_id);

        if (!$payment || $payment->payer_id !== $user->id) {
            return $this->forbidden('You do not have permission to request refund for this payment');
        }

        $refund = CodeMartV1RefundModel::create([
            'payment_id' => $request->payment_id,
            'amount' => $payment->amount,
            'reason' => $request->reason,
            'notes' => $request->notes,
            'requested_at' => now(),
            'status' => 'pending',
        ]);

        return $this->success($refund, 'Refund request created successfully', 201);
    }

    public function approveRefund(Request $request, int $refundId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        if ($user->rolelevel < 2) {
            return $this->forbidden('Insufficient permissions to approve refund');
        }

        $refund = CodeMartV1RefundModel::find($refundId);

        if (!$refund) {
            return $this->notFound('Refund not found');
        }

        if (!$refund->approve()) {
            return $this->error('Cannot approve refund in current status', 422);
        }

        return $this->success($refund, 'Refund approved successfully');
    }

    public function processRefund(Request $request, int $refundId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        if ($user->rolelevel < 2) {
            return $this->forbidden('Insufficient permissions to process refund');
        }

        $refund = CodeMartV1RefundModel::find($refundId);

        if (!$refund) {
            return $this->notFound('Refund not found');
        }

        CodeMartV1PaymentModel::beginModelTransaction();

        if (!$refund->complete()) {
            CodeMartV1PaymentModel::rollBackModelTransaction();
            return $this->error('Cannot process refund in current status', 422);
        }

        $payment = $refund->payment;
        $payment->update(['status' => 'cancelled']);

        CodeMartV1PaymentModel::commitModelTransaction();

        return $this->success($refund, 'Refund processed successfully');
    }
}
