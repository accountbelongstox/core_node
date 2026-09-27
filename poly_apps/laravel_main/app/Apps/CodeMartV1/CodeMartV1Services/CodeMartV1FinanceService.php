<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use Illuminate\Http\Request;

/**
 * Shared money primitives: decimal normalization, commission, idempotency,
 * pagination envelope, and the refund settlement used by every admin path.
 */
class CodeMartV1FinanceService
{
    public static function money(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    public static function commission(string $gross): string
    {
        $raw = bcmul($gross, (string) CodeMartV1Constants::PLATFORM_COMMISSION_RATE, 6);

        return self::money(round((float) $raw, 2));
    }

    public static function idempotencyKey(Request $request): ?string
    {
        $key = trim((string) $request->header(CodeMartV1Constants::IDEMPOTENCY_HEADER, ''));
        if ($key === '') {
            return null;
        }

        return substr($key, 0, CodeMartV1Constants::IDEMPOTENCY_KEY_MAX_LENGTH);
    }

    public static function pageParams(Request $request): array
    {
        $page = max(1, (int) $request->query('page', 1));
        $size = $request->query('page_size', $request->query('pageSize', CodeMartV1Constants::DEFAULT_PAGE_SIZE));
        $pageSize = min(CodeMartV1Constants::MAX_PAGE_SIZE, max(1, (int) $size));

        return [$page, $pageSize];
    }

    /** Standard list envelope from a BuildsModelPagination result. */
    public static function pageResult(array $result, string $key, int $page, int $pageSize, ?callable $map = null): array
    {
        $items = $result[$key]->items();
        if ($map !== null) {
            $items = array_map($map, $items);
        }
        $total = (int) $result['total'];

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'total_pages' => (int) ceil($total / max(1, $pageSize)),
        ];
    }

    /**
     * Runs $create inside a transaction serialized on the user's wallet row;
     * a repeated idempotency key returns the prior record instead.
     *
     * @return array{0: mixed, 1: bool} [record, replayed]
     */
    public static function idempotent(int $userId, ?string $key, callable $find, callable $create): array
    {
        return CodeMartV1WalletModel::runInTransaction(function () use ($userId, $key, $find, $create): array {
            CodeMartV1WalletModel::lockForUser($userId);
            if ($key !== null) {
                $prior = $find($key);
                if ($prior !== null) {
                    return [$prior, true];
                }
            }

            return [$create(), false];
        });
    }

    /**
     * Settles an approved refund: debits the escrow (while funds are still
     * held) or the payee, credits the payer, marks the payment refunded.
     * Re-processing a completed refund is a no-op replay.
     *
     * @return array{refund: CodeMartV1RefundModel, payment: CodeMartV1PaymentModel, replayed: bool, source: string}
     */
    public static function processRefund(int $refundId, int $adminId, ?string $notes = null): array
    {
        $result = CodeMartV1WalletModel::runInTransaction(function () use ($refundId, $adminId, $notes): array {
            $refund = CodeMartV1RefundModel::lockById($refundId);
            if (!$refund) {
                throw new CodeMartV1FinanceException('refund_not_found', 'Refund not found', 404);
            }

            $payment = CodeMartV1PaymentModel::lockById((int) $refund->payment_id);
            if (!$payment) {
                throw new CodeMartV1FinanceException('payment_not_found', 'Payment not found', 404);
            }

            if ($refund->status === CodeMartV1Constants::REFUND_STATUS_COMPLETED) {
                return ['refund' => $refund, 'payment' => $payment, 'replayed' => true, 'source' => 'none'];
            }
            if ($refund->status !== CodeMartV1Constants::REFUND_STATUS_APPROVED) {
                throw new CodeMartV1FinanceException('refund_invalid_state', 'Only approved refunds can be processed', 409);
            }
            if (!in_array($payment->status, [
                CodeMartV1Constants::PAYMENT_STATUS_COMPLETED,
                CodeMartV1Constants::PAYMENT_STATUS_DISPUTED,
            ], true)) {
                throw new CodeMartV1FinanceException('payment_invalid_state', 'Payment is not refundable in its current status', 409);
            }

            $amount = self::money($refund->amount);
            $escrowId = (int) (($payment->metadata ?? [])['held_escrow_id'] ?? 0);
            $escrow = $escrowId > 0
                ? CodeMartV1EscrowModel::query()->whereKey($escrowId)->lockForUpdate()->first()
                : null;
            $useEscrow = $escrow
                && $escrow->status === CodeMartV1Constants::ESCROW_STATUS_HELD
                && bccomp($escrow->remainingAmount(), $amount, 2) >= 0;

            $payerId = (int) $payment->payer_id;
            $payeeId = (int) $payment->payee_id;
            $wallets = CodeMartV1WalletModel::lockForUsers($useEscrow ? [$payerId] : [$payerId, $payeeId]);
            $ledgerMeta = ['refund_id' => $refund->id, 'payment_id' => $payment->id];

            if ($useEscrow) {
                $escrow->recordRefund($amount, 'refund:' . $refund->id);
                $ledgerMeta['escrow_id'] = $escrow->id;
            } elseif (!$wallets[$payeeId]->debit(
                $amount,
                CodeMartV1Constants::WALLET_TX_REFUND,
                "Refund debit for payment {$payment->id}",
                $ledgerMeta
            )) {
                throw new CodeMartV1FinanceException('payee_insufficient_balance', 'Payee available balance is insufficient for this refund', 409);
            }

            $wallets[$payerId]->credit(
                $amount,
                CodeMartV1Constants::WALLET_TX_REFUND,
                "Refund credit for payment {$payment->id}",
                $ledgerMeta
            );

            $refund->update([
                'status' => CodeMartV1Constants::REFUND_STATUS_COMPLETED,
                'processed_at' => now(),
                'admin_id' => $adminId,
                'admin_notes' => $notes ?? $refund->admin_notes,
            ]);
            $payment->update(['status' => CodeMartV1Constants::PAYMENT_STATUS_REFUNDED]);

            return ['refund' => $refund, 'payment' => $payment, 'replayed' => false, 'source' => $useEscrow ? 'escrow' : 'payee'];
        });

        if (!$result['replayed']) {
            CodeMartV1DomainEventService::emit(
                $adminId,
                'refund',
                (int) $result['refund']->id,
                'refund_processed',
                CodeMartV1Constants::REFUND_STATUS_APPROVED,
                CodeMartV1Constants::REFUND_STATUS_COMPLETED,
                [(int) $result['payment']->payer_id, (int) $result['payment']->payee_id],
                CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                'notifications.refundProcessed',
                'notifications.refundProcessedBody',
                ['amount' => (string) $result['refund']->amount, 'payment_id' => (int) $result['payment']->id]
            );
        }

        return $result;
    }
}
