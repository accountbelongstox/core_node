<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1InvoiceModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CodeMartV1PaymentCtl extends Controller
{
    public function getWallet(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $wallet = CodeMartV1WalletModel::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'available_balance' => 0, 'frozen_balance' => 0]
        );

        return response()->json([
            'success' => true,
            'data' => $wallet,
        ], 200);
    }

    public function getWalletTransactions(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $wallet = CodeMartV1WalletModel::where('user_id', $user->id)->first();

        if (!$wallet) {
            return response()->json(['success' => false, 'message' => 'Wallet not found'], 404);
        }

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $total = $wallet->transactions()->count();
        $transactions = $wallet->transactions()
            ->orderBy('created_at', 'desc')
            ->paginate($pageSize, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $transactions->items(),
                'total' => $total,
                'page' => $page,
                'pageSize' => $pageSize,
                'totalPages' => ceil($total / $pageSize),
            ],
        ], 200);
    }

    public function createPayment(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

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
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $payer_wallet = CodeMartV1WalletModel::where('user_id', $user->id)->first();

            if ($request->payment_method === 'wallet') {
                if (!$payer_wallet || $payer_wallet->available_balance < $request->amount) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Insufficient wallet balance',
                    ], 422);
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

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Payment created successfully',
                'data' => $payment->load(['payer', 'payee']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getPayment(int $paymentId): JsonResponse
    {
        $payment = CodeMartV1PaymentModel::with([
            'payer',
            'payee',
            'invoice',
            'refund',
        ])->find($paymentId);

        if (!$payment) {
            return response()->json(['success' => false, 'message' => 'Payment not found'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $payment,
        ], 200);
    }

    public function getPayments(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

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

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $payments->items(),
                'total' => $total,
                'page' => $page,
                'pageSize' => $pageSize,
                'totalPages' => ceil($total / $pageSize),
            ],
        ], 200);
    }

    public function createInvoice(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|exists:codemart_payments,id',
            'description' => 'nullable|string',
            'line_items' => 'nullable|array',
            'tax' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $payment = CodeMartV1PaymentModel::find($request->payment_id);

            if (!$payment || $payment->payee_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
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
                'issued_date' => now()->date(),
                'status' => 'sent',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Invoice created successfully',
                'data' => $invoice->load('payment'),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create invoice: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function requestRefund(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|exists:codemart_payments,id',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $payment = CodeMartV1PaymentModel::find($request->payment_id);

            if (!$payment || $payment->payer_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            $refund = CodeMartV1RefundModel::create([
                'payment_id' => $request->payment_id,
                'amount' => $payment->amount,
                'reason' => $request->reason,
                'notes' => $request->notes,
                'requested_at' => now(),
                'status' => 'pending',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Refund request created successfully',
                'data' => $refund,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create refund request: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function approveRefund(Request $request, int $refundId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user || $user->rolelevel < 2) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $refund = CodeMartV1RefundModel::find($refundId);

        if (!$refund) {
            return response()->json(['success' => false, 'message' => 'Refund not found'], 404);
        }

        if (!$refund->approve()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot approve refund in current status',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Refund approved successfully',
            'data' => $refund,
        ], 200);
    }

    public function processRefund(Request $request, int $refundId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user || $user->rolelevel < 2) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $refund = CodeMartV1RefundModel::find($refundId);

        if (!$refund) {
            return response()->json(['success' => false, 'message' => 'Refund not found'], 404);
        }

        try {
            DB::beginTransaction();

            if (!$refund->complete()) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot process refund in current status',
                ], 422);
            }

            $payment = $refund->payment;
            $payment->update(['status' => 'cancelled']);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Refund processed successfully',
                'data' => $refund,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to process refund: ' . $e->getMessage(),
            ], 500);
        }
    }
}
