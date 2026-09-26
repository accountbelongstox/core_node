<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1RefundModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WithdrawalModel;

/**
 * Administrator finance transitions (refunds, deposits, withdrawals,
 * disputes) and listings. Controllers must pass AuthHelper::requireAdmin.
 * Failures throw CodeMartV1FinanceException with a machine error code.
 */
class CodeMartV1AdminFinanceService
{
    private static function userSummary(mixed $user): ?array
    {
        if (!$user) {
            return null;
        }

        return ['id' => (int) $user->id, 'username' => $user->username ?? null, 'name' => $user->name ?? null];
    }

    public function paymentsPage(?string $status, ?string $type, int $page, int $pageSize): array
    {
        $result = CodeMartV1PaymentModel::adminPage($status, $type, $page, $pageSize);

        return CodeMartV1FinanceService::pageResult($result, 'payments', $page, $pageSize, static fn (CodeMartV1PaymentModel $payment): array => [
            'id' => $payment->id,
            'payer' => self::userSummary($payment->payer),
            'payee' => self::userSummary($payment->payee),
            'project_id' => $payment->project_id,
            'milestone_id' => $payment->milestone_id,
            'amount' => (string) $payment->amount,
            'currency' => $payment->currency,
            'type' => $payment->type,
            'status' => $payment->status,
            'payment_method' => $payment->payment_method,
            'business_ref' => $payment->business_ref,
            'created_at' => $payment->created_at?->toIso8601String(),
        ]);
    }

    public function escrowsPage(?string $status, ?int $projectId, int $page, int $pageSize): array
    {
        $result = CodeMartV1EscrowModel::adminPage($status, $projectId, $page, $pageSize);

        return CodeMartV1FinanceService::pageResult($result, 'escrows', $page, $pageSize, static fn (CodeMartV1EscrowModel $escrow): array => [
            'id' => $escrow->id,
            'project_id' => $escrow->project_id,
            'project_title' => $escrow->project?->title,
            'escrow_type' => $escrow->escrow_type,
            'payer' => self::userSummary($escrow->payer),
            'payee' => self::userSummary($escrow->payee),
            'amount' => (string) $escrow->amount,
            'released_amount' => CodeMartV1FinanceService::money($escrow->released_amount ?? 0),
            'refunded_amount' => CodeMartV1FinanceService::money($escrow->refunded_amount ?? 0),
            'remaining_amount' => $escrow->remainingAmount(),
            'currency' => $escrow->currency,
            'status' => $escrow->status,
            'released_at' => $escrow->released_at?->toIso8601String(),
            'created_at' => $escrow->created_at?->toIso8601String(),
        ]);
    }

    public function withdrawalsPage(?string $status, int $page, int $pageSize): array
    {
        $result = CodeMartV1WithdrawalModel::adminPage($status, $page, $pageSize);

        return CodeMartV1FinanceService::pageResult($result, 'withdrawals', $page, $pageSize, static fn (CodeMartV1WithdrawalModel $withdrawal): array => [
            'id' => $withdrawal->id,
            'user' => self::userSummary($withdrawal->user),
            'amount' => (string) $withdrawal->amount,
            'currency' => $withdrawal->currency,
            'status' => $withdrawal->status,
            'method' => $withdrawal->method,
            'account_info' => $withdrawal->account_info,
            'admin_id' => $withdrawal->admin_id,
            'admin_notes' => $withdrawal->admin_notes,
            'reviewed_at' => $withdrawal->reviewed_at?->toIso8601String(),
            'paid_at' => $withdrawal->paid_at?->toIso8601String(),
            'created_at' => $withdrawal->created_at?->toIso8601String(),
        ]);
    }

    public function approveRefund(int $refundId, int $adminId, ?string $notes): CodeMartV1RefundModel
    {
        $refund = CodeMartV1RefundModel::runInTransaction(function () use ($refundId, $adminId, $notes): CodeMartV1RefundModel {
            $refund = $this->lockRefund($refundId);
            if ($refund->status !== CodeMartV1Constants::REFUND_STATUS_PENDING) {
                throw new CodeMartV1FinanceException('refund_invalid_state', 'Only pending refunds can be approved', 409);
            }
            $refund->update([
                'status' => CodeMartV1Constants::REFUND_STATUS_APPROVED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'reviewed_at' => now(),
            ]);

            return $refund;
        });

        $this->emitRefund($refund, $adminId, 'refund_approved', CodeMartV1Constants::REFUND_STATUS_PENDING, 'notifications.refundApproved');

        return $refund;
    }

    public function rejectRefund(int $refundId, int $adminId, ?string $notes): CodeMartV1RefundModel
    {
        $fromState = null;
        $refund = CodeMartV1RefundModel::runInTransaction(function () use ($refundId, $adminId, $notes, &$fromState): CodeMartV1RefundModel {
            $refund = $this->lockRefund($refundId);
            if (!$refund->isOpen()) {
                throw new CodeMartV1FinanceException('refund_invalid_state', 'Only open refunds can be rejected', 409);
            }
            $fromState = $refund->status;
            $refund->update([
                'status' => CodeMartV1Constants::REFUND_STATUS_REJECTED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'reviewed_at' => now(),
            ]);

            $payment = CodeMartV1PaymentModel::lockById((int) $refund->payment_id);
            if ($payment && $payment->status === CodeMartV1Constants::PAYMENT_STATUS_DISPUTED) {
                $payment->update(['status' => CodeMartV1Constants::PAYMENT_STATUS_COMPLETED]);
            }

            return $refund;
        });

        $this->emitRefund($refund, $adminId, 'refund_rejected', $fromState, 'notifications.refundRejected');

        return $refund;
    }

    public function processRefund(int $refundId, int $adminId, ?string $notes): array
    {
        return CodeMartV1FinanceService::processRefund($refundId, $adminId, $notes);
    }

    private function lockRefund(int $refundId): CodeMartV1RefundModel
    {
        $refund = CodeMartV1RefundModel::lockById($refundId);
        if (!$refund) {
            throw new CodeMartV1FinanceException('refund_not_found', 'Refund not found', 404);
        }

        return $refund;
    }

    private function emitRefund(CodeMartV1RefundModel $refund, int $adminId, string $action, ?string $fromState, string $titleKey): void
    {
        $payment = CodeMartV1PaymentModel::findById((int) $refund->payment_id);
        CodeMartV1DomainEventService::emit(
            $adminId,
            'refund',
            (int) $refund->id,
            $action,
            $fromState,
            $refund->status,
            $payment ? [(int) $payment->payer_id, (int) $payment->payee_id] : [],
            CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            $titleKey,
            $titleKey . 'Body',
            ['amount' => (string) $refund->amount, 'payment_id' => (int) $refund->payment_id, 'notes' => $refund->admin_notes]
        );
    }

    /**
     * Resolves a disputed payment: `refund` approves (or creates) the open
     * refund and settles it; `complete` rejects open refunds and restores
     * the payment to completed. Runs as one transaction.
     */
    public function resolveDispute(int $paymentId, string $resolution, int $adminId, ?string $notes): array
    {
        $result = CodeMartV1PaymentModel::runInTransaction(function () use ($paymentId, $resolution, $adminId, $notes): array {
            $payment = CodeMartV1PaymentModel::lockById($paymentId);
            if (!$payment) {
                throw new CodeMartV1FinanceException('payment_not_found', 'Payment not found', 404);
            }
            if ($payment->status !== CodeMartV1Constants::PAYMENT_STATUS_DISPUTED) {
                throw new CodeMartV1FinanceException('payment_not_disputed', 'Payment is not disputed', 409);
            }

            $openRefund = CodeMartV1RefundModel::query()
                ->where('payment_id', $payment->id)
                ->whereIn('status', CodeMartV1RefundModel::OPEN_STATUSES)
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            if ($resolution === CodeMartV1Constants::DISPUTE_RESOLUTION_COMPLETE) {
                if ($openRefund) {
                    $openRefund->update([
                        'status' => CodeMartV1Constants::REFUND_STATUS_REJECTED,
                        'admin_id' => $adminId,
                        'admin_notes' => $notes,
                        'reviewed_at' => now(),
                    ]);
                }
                $payment->update(['status' => CodeMartV1Constants::PAYMENT_STATUS_COMPLETED]);

                return ['payment' => $payment, 'refund' => $openRefund];
            }

            if (!$openRefund) {
                $openRefund = CodeMartV1RefundModel::createRecord([
                    'payment_id' => $payment->id,
                    'amount' => $payment->amount,
                    'reason' => 'dispute_resolution',
                    'notes' => $notes,
                    'requested_at' => now(),
                    'requested_by' => $payment->payer_id,
                    'status' => CodeMartV1Constants::REFUND_STATUS_PENDING,
                ]);
            }
            $openRefund->update([
                'status' => CodeMartV1Constants::REFUND_STATUS_APPROVED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'reviewed_at' => now(),
            ]);

            $processed = CodeMartV1FinanceService::processRefund((int) $openRefund->id, $adminId, $notes);

            return ['payment' => $processed['payment'], 'refund' => $processed['refund']];
        });

        $payment = $result['payment'];
        CodeMartV1DomainEventService::emit(
            $adminId,
            'payment',
            (int) $payment->id,
            'dispute_resolved',
            CodeMartV1Constants::PAYMENT_STATUS_DISPUTED,
            $payment->status,
            [(int) $payment->payer_id, (int) $payment->payee_id],
            CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            $resolution === CodeMartV1Constants::DISPUTE_RESOLUTION_REFUND
                ? 'notifications.disputeResolvedRefund'
                : 'notifications.disputeResolvedComplete',
            $resolution === CodeMartV1Constants::DISPUTE_RESOLUTION_REFUND
                ? 'notifications.disputeResolvedRefundBody'
                : 'notifications.disputeResolvedCompleteBody',
            ['amount' => (string) $payment->amount, 'resolution' => $resolution, 'notes' => $notes]
        );

        return [
            'payment_id' => (int) $payment->id,
            'payment_status' => $payment->status,
            'refund_id' => $result['refund']?->id,
            'refund_status' => $result['refund']?->status,
            'resolution' => $resolution,
        ];
    }

    public function rejectDeposit(int $depositId, int $adminId, ?string $notes): CodeMartV1DepositModel
    {
        $deposit = CodeMartV1DepositModel::runInTransaction(function () use ($depositId, $adminId, $notes): CodeMartV1DepositModel {
            $deposit = $this->lockDeposit($depositId);
            if ($deposit->status !== CodeMartV1Constants::DEPOSIT_STATUS_PENDING) {
                throw new CodeMartV1FinanceException('deposit_invalid_state', 'Only pending deposits can be rejected', 409);
            }
            $deposit->update([
                'status' => CodeMartV1Constants::DEPOSIT_STATUS_REJECTED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'reviewed_at' => now(),
            ]);

            return $deposit;
        });

        CodeMartV1DomainEventService::emit(
            $adminId,
            'deposit',
            (int) $deposit->id,
            'deposit_rejected',
            CodeMartV1Constants::DEPOSIT_STATUS_PENDING,
            CodeMartV1Constants::DEPOSIT_STATUS_REJECTED,
            [(int) $deposit->user_id],
            CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            'notifications.depositRejected',
            'notifications.depositRejectedBody',
            ['amount' => (string) $deposit->amount, 'role' => $deposit->role_type, 'notes' => $notes]
        );

        return $deposit;
    }

    /**
     * Returns a paid deposit to the user's wallet and suspends every active
     * role whose deposit policy is no longer satisfied.
     */
    public function refundDeposit(int $depositId, int $adminId, ?string $notes): array
    {
        $result = CodeMartV1DepositModel::runInTransaction(function () use ($depositId, $adminId, $notes): array {
            $deposit = $this->lockDeposit($depositId);
            if ($deposit->status !== CodeMartV1Constants::DEPOSIT_STATUS_PAID) {
                throw new CodeMartV1FinanceException('deposit_invalid_state', 'Only paid deposits can be refunded', 409);
            }

            $userId = (int) $deposit->user_id;
            $wallet = CodeMartV1WalletModel::lockForUser($userId);
            $deposit->update([
                'status' => CodeMartV1Constants::DEPOSIT_STATUS_REFUNDED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'refunded_at' => now(),
            ]);
            $wallet->credit(
                CodeMartV1FinanceService::money($deposit->amount),
                CodeMartV1Constants::WALLET_TX_DEPOSIT,
                "Deposit {$deposit->id} refunded",
                ['deposit_id' => $deposit->id, 'kind' => 'deposit_refund', 'role_type' => $deposit->role_type]
            );

            $affectedRoles = array_unique([$deposit->role_type, CodeMartV1Constants::ROLE_ARCHITECT]);
            $suspended = [];
            foreach ($affectedRoles as $roleType) {
                $role = CodeMartV1UserRoleModel::forUserAndType($userId, $roleType, CodeMartV1Constants::ROLE_STATUS_ACTIVE);
                if (!$role || CodeMartV1DepositModel::policyForRole($userId, $roleType)['is_sufficient']) {
                    continue;
                }
                $role->updateRecord(['role_status' => CodeMartV1Constants::ROLE_STATUS_SUSPENDED]);
                $suspended[] = $roleType;
            }

            return ['deposit' => $deposit, 'suspended_roles' => $suspended];
        });

        $deposit = $result['deposit'];
        CodeMartV1DomainEventService::emit(
            $adminId,
            'deposit',
            (int) $deposit->id,
            'deposit_refunded',
            CodeMartV1Constants::DEPOSIT_STATUS_PAID,
            CodeMartV1Constants::DEPOSIT_STATUS_REFUNDED,
            [(int) $deposit->user_id],
            CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            'notifications.depositRefunded',
            'notifications.depositRefundedBody',
            ['amount' => (string) $deposit->amount, 'role' => $deposit->role_type, 'notes' => $notes]
        );
        foreach ($result['suspended_roles'] as $roleType) {
            CodeMartV1DomainEventService::emit(
                $adminId,
                'role',
                (int) $deposit->user_id,
                'role_suspended',
                CodeMartV1Constants::ROLE_STATUS_ACTIVE,
                CodeMartV1Constants::ROLE_STATUS_SUSPENDED,
                [(int) $deposit->user_id],
                CodeMartV1Constants::NOTIFICATION_TYPE_ONBOARDING,
                'notifications.roleSuspendedDeposit',
                'notifications.roleSuspendedDepositBody',
                ['role' => $roleType]
            );
        }

        return [
            'id' => (int) $deposit->id,
            'status' => $deposit->status,
            'amount' => (string) $deposit->amount,
            'suspended_roles' => $result['suspended_roles'],
        ];
    }

    private function lockDeposit(int $depositId): CodeMartV1DepositModel
    {
        $deposit = CodeMartV1DepositModel::lockById($depositId);
        if (!$deposit) {
            throw new CodeMartV1FinanceException('deposit_not_found', 'Deposit not found', 404);
        }

        return $deposit;
    }

    public function approveWithdrawal(int $withdrawalId, int $adminId, ?string $notes): CodeMartV1WithdrawalModel
    {
        $withdrawal = CodeMartV1WithdrawalModel::runInTransaction(function () use ($withdrawalId, $adminId, $notes): CodeMartV1WithdrawalModel {
            $withdrawal = $this->lockWithdrawal($withdrawalId);
            if ($withdrawal->status !== CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING) {
                throw new CodeMartV1FinanceException('withdrawal_invalid_state', 'Only pending withdrawals can be approved', 409);
            }
            $withdrawal->update([
                'status' => CodeMartV1Constants::WITHDRAWAL_STATUS_APPROVED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'reviewed_at' => now(),
            ]);

            return $withdrawal;
        });

        $this->emitWithdrawal($withdrawal, $adminId, 'withdrawal_approved', CodeMartV1Constants::WITHDRAWAL_STATUS_PENDING, 'notifications.withdrawalApproved');

        return $withdrawal;
    }

    public function rejectWithdrawal(int $withdrawalId, int $adminId, ?string $notes): CodeMartV1WithdrawalModel
    {
        $fromState = null;
        $withdrawal = CodeMartV1WithdrawalModel::runInTransaction(function () use ($withdrawalId, $adminId, $notes, &$fromState): CodeMartV1WithdrawalModel {
            $withdrawal = $this->lockWithdrawal($withdrawalId);
            if (!$withdrawal->isOpen()) {
                throw new CodeMartV1FinanceException('withdrawal_invalid_state', 'Only open withdrawals can be rejected', 409);
            }
            $fromState = $withdrawal->status;
            $wallet = CodeMartV1WalletModel::lockForUser((int) $withdrawal->user_id);
            $ledger = $wallet->unfreeze(
                CodeMartV1FinanceService::money($withdrawal->amount),
                CodeMartV1Constants::WALLET_TX_WITHDRAWAL,
                "Withdrawal {$withdrawal->id} rejected",
                ['withdrawal_id' => $withdrawal->id, 'phase' => 'unfreeze']
            );
            if (!$ledger) {
                throw new CodeMartV1FinanceException('wallet_frozen_mismatch', 'Frozen balance does not cover this withdrawal', 409);
            }
            $withdrawal->update([
                'status' => CodeMartV1Constants::WITHDRAWAL_STATUS_REJECTED,
                'admin_id' => $adminId,
                'admin_notes' => $notes,
                'reviewed_at' => now(),
            ]);

            return $withdrawal;
        });

        $this->emitWithdrawal($withdrawal, $adminId, 'withdrawal_rejected', $fromState, 'notifications.withdrawalRejected');

        return $withdrawal;
    }

    public function payWithdrawal(int $withdrawalId, int $adminId, ?string $notes): CodeMartV1WithdrawalModel
    {
        $withdrawal = CodeMartV1WithdrawalModel::runInTransaction(function () use ($withdrawalId, $adminId, $notes): CodeMartV1WithdrawalModel {
            $withdrawal = $this->lockWithdrawal($withdrawalId);
            if ($withdrawal->status !== CodeMartV1Constants::WITHDRAWAL_STATUS_APPROVED) {
                throw new CodeMartV1FinanceException('withdrawal_invalid_state', 'Only approved withdrawals can be marked paid', 409);
            }
            $wallet = CodeMartV1WalletModel::lockForUser((int) $withdrawal->user_id);
            $ledger = $wallet->settleFrozen(
                CodeMartV1FinanceService::money($withdrawal->amount),
                CodeMartV1Constants::WALLET_TX_WITHDRAWAL,
                "Withdrawal {$withdrawal->id} paid",
                ['withdrawal_id' => $withdrawal->id, 'phase' => 'settle', 'method' => $withdrawal->method]
            );
            if (!$ledger) {
                throw new CodeMartV1FinanceException('wallet_frozen_mismatch', 'Frozen balance does not cover this withdrawal', 409);
            }
            $withdrawal->update([
                'status' => CodeMartV1Constants::WITHDRAWAL_STATUS_PAID,
                'admin_id' => $adminId,
                'admin_notes' => $notes ?? $withdrawal->admin_notes,
                'paid_at' => now(),
            ]);

            return $withdrawal;
        });

        $this->emitWithdrawal($withdrawal, $adminId, 'withdrawal_paid', CodeMartV1Constants::WITHDRAWAL_STATUS_APPROVED, 'notifications.withdrawalPaid');

        return $withdrawal;
    }

    private function lockWithdrawal(int $withdrawalId): CodeMartV1WithdrawalModel
    {
        $withdrawal = CodeMartV1WithdrawalModel::lockById($withdrawalId);
        if (!$withdrawal) {
            throw new CodeMartV1FinanceException('withdrawal_not_found', 'Withdrawal not found', 404);
        }

        return $withdrawal;
    }

    private function emitWithdrawal(CodeMartV1WithdrawalModel $withdrawal, int $adminId, string $action, ?string $fromState, string $titleKey): void
    {
        CodeMartV1DomainEventService::emit(
            $adminId,
            'withdrawal',
            (int) $withdrawal->id,
            $action,
            $fromState,
            $withdrawal->status,
            [(int) $withdrawal->user_id],
            CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
            $titleKey,
            $titleKey . 'Body',
            ['amount' => (string) $withdrawal->amount, 'method' => $withdrawal->method, 'notes' => $withdrawal->admin_notes]
        );
    }
}
