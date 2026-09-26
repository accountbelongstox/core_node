<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1EscrowModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PaymentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectProposalModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1WalletModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Project escrow: funding moves the accepted amount from the client wallet
 * into a platform-held escrow; approving a task releases its budget minus
 * platform commission to the assigned developer, once per task.
 */
class CodeMartV1EscrowService
{
    public static function fundingAmount(CodeMartV1ProjectModel $project): string
    {
        $proposal = CodeMartV1ProjectProposalModel::query()
            ->where('project_id', $project->id)
            ->where('status', CodeMartV1Constants::PROPOSAL_STATUS_APPROVED)
            ->first();

        $amount = $proposal && $proposal->estimated_cost !== null && (float) $proposal->estimated_cost > 0
            ? $proposal->estimated_cost
            : $project->budget;

        return CodeMartV1FinanceService::money($amount ?? 0);
    }

    /**
     * @return array{escrow: CodeMartV1EscrowModel, replayed: bool, from_state: ?string}
     */
    public static function fundProject(int $projectId, int $clientId, ?string $idempotencyKey): array
    {
        $result = CodeMartV1WalletModel::runInTransaction(function () use ($projectId, $clientId, $idempotencyKey): array {
            $wallet = CodeMartV1WalletModel::lockForUser($clientId);

            if ($idempotencyKey !== null) {
                $prior = CodeMartV1EscrowModel::findByIdempotencyKey($clientId, $idempotencyKey);
                if ($prior) {
                    return ['escrow' => $prior, 'replayed' => true, 'from_state' => null];
                }
            }

            $project = CodeMartV1ProjectModel::query()->whereKey($projectId)->lockForUpdate()->first();
            if (!$project) {
                throw new CodeMartV1FinanceException('project_not_found', 'Project not found', 404);
            }
            if ((int) $project->client_id !== $clientId) {
                throw new CodeMartV1FinanceException('not_project_owner', 'Only the project owner can fund this project', 403);
            }
            if ($project->status !== CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING) {
                throw new CodeMartV1FinanceException('project_not_funding_pending', 'Project is not awaiting funding', 409);
            }

            $amount = self::fundingAmount($project);
            if (bccomp($amount, '0', 2) <= 0) {
                throw new CodeMartV1FinanceException('funding_amount_missing', 'Project has no accepted proposal amount or budget', 422);
            }

            $ledger = $wallet->debit(
                $amount,
                CodeMartV1Constants::WALLET_TX_ESCROW_HOLD,
                "Project {$project->id} funding into escrow",
                ['project_id' => $project->id]
            );
            if (!$ledger) {
                throw new CodeMartV1FinanceException('insufficient_balance', 'Insufficient available wallet balance', 422);
            }

            $escrow = CodeMartV1EscrowModel::createRecord([
                'project_id' => $project->id,
                'payer_id' => $clientId,
                'payee_id' => $clientId,
                'amount' => $amount,
                'currency' => $project->currency ?: CodeMartV1Constants::DEFAULT_CURRENCY,
                'status' => CodeMartV1Constants::ESCROW_STATUS_HELD,
                'escrow_type' => CodeMartV1Constants::ESCROW_TYPE_PROJECT_FUNDING,
                'released_amount' => 0,
                'refunded_amount' => 0,
                'idempotency_key' => $idempotencyKey,
                'metadata' => ['wallet_transaction_id' => $ledger->id],
            ]);

            CodeMartV1ProjectModel::query()->whereKey($project->id)->update([
                'status' => CodeMartV1Constants::PROJECT_STATUS_OPEN,
                'state_revision' => DB::raw('COALESCE(state_revision, 0) + 1'),
                'updated_at' => now(),
            ]);

            return ['escrow' => $escrow, 'replayed' => false, 'from_state' => $project->status];
        });

        if (!$result['replayed']) {
            $escrow = $result['escrow'];
            $project = CodeMartV1ProjectModel::findById($projectId);
            CodeMartV1DomainEventService::emit(
                $clientId,
                'project',
                $projectId,
                'project_funded',
                $result['from_state'],
                CodeMartV1Constants::PROJECT_STATUS_OPEN,
                array_filter([(int) ($project->architect_id ?? 0), $clientId]),
                CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                'notifications.projectFunded',
                'notifications.projectFundedBody',
                ['amount' => (string) $escrow->amount, 'escrow_id' => (int) $escrow->id, 'project_id' => $projectId]
            );
        }

        return $result;
    }

    private static function projectIdForTask(CodeMartV1TaskModel $task): ?int
    {
        $direct = $task->getAttribute('project_id');
        if ($direct) {
            return (int) $direct;
        }
        if (!$task->milestone_id) {
            return null;
        }
        $milestone = CodeMartV1MilestoneModel::findById((int) $task->milestone_id);

        return $milestone ? (int) $milestone->project_id : null;
    }

    /**
     * Releases the task budget from the project escrow to the assigned
     * developer minus platform commission. Idempotent per task via the
     * payment business_ref; never throws.
     */
    public static function releaseForTask(CodeMartV1TaskModel $task, int $approverId): array
    {
        $businessRef = CodeMartV1Constants::BUSINESS_REF_TASK_RELEASE . $task->id;
        $amount = CodeMartV1FinanceService::money($task->budget_allocation ?? 0);
        $developerId = (int) ($task->assigned_to ?? 0);
        $projectId = self::projectIdForTask($task);

        if ($projectId === null) {
            return ['released' => false, 'amount' => $amount, 'error_code' => 'task_project_missing'];
        }
        if ($developerId <= 0) {
            return ['released' => false, 'amount' => $amount, 'error_code' => 'task_not_assigned'];
        }
        if (bccomp($amount, '0', 2) <= 0) {
            return ['released' => false, 'amount' => $amount, 'error_code' => 'task_budget_missing'];
        }

        try {
            $result = CodeMartV1WalletModel::runInTransaction(function () use ($task, $projectId, $developerId, $amount, $businessRef): array {
                $escrows = CodeMartV1EscrowModel::query()
                    ->where('project_id', $projectId)
                    ->where('escrow_type', CodeMartV1Constants::ESCROW_TYPE_PROJECT_FUNDING)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                $prior = CodeMartV1PaymentModel::findByBusinessRef($businessRef);
                if ($prior) {
                    return ['payment' => $prior, 'replayed' => true, 'commission' => (string) (($prior->metadata ?? [])['commission'] ?? '0.00')];
                }

                $escrow = $escrows->first(
                    static fn (CodeMartV1EscrowModel $row): bool => $row->status === CodeMartV1Constants::ESCROW_STATUS_HELD
                        && bccomp($row->remainingAmount(), $amount, 2) >= 0
                );
                if (!$escrow) {
                    throw new CodeMartV1FinanceException('escrow_insufficient', 'Project escrow does not hold enough funds for this task', 409);
                }

                $commission = CodeMartV1FinanceService::commission($amount);
                $net = bcsub($amount, $commission, 2);
                $meta = [
                    'task_id' => $task->id,
                    'project_id' => $projectId,
                    'escrow_id' => $escrow->id,
                    'gross' => $amount,
                    'commission' => $commission,
                ];

                $wallet = CodeMartV1WalletModel::lockForUser($developerId);
                $wallet->credit($net, CodeMartV1Constants::WALLET_TX_ESCROW_RELEASE, "Task {$task->id} escrow release", $meta);
                $escrow->recordRelease($amount, $businessRef);

                $payment = CodeMartV1PaymentModel::createRecord([
                    'payer_id' => $escrow->payer_id,
                    'payee_id' => $developerId,
                    'project_id' => $projectId,
                    'milestone_id' => $task->milestone_id,
                    'amount' => $net,
                    'currency' => $escrow->currency ?: CodeMartV1Constants::DEFAULT_CURRENCY,
                    'type' => CodeMartV1Constants::PAYMENT_TYPE_MILESTONE,
                    'status' => CodeMartV1Constants::PAYMENT_STATUS_COMPLETED,
                    'payment_method' => CodeMartV1Constants::PAYMENT_METHOD_WALLET,
                    'business_ref' => $businessRef,
                    'metadata' => $meta,
                ]);

                return ['payment' => $payment, 'replayed' => false, 'commission' => $commission];
            });
        } catch (CodeMartV1FinanceException $e) {
            return ['released' => false, 'amount' => $amount, 'error_code' => $e->errorCode];
        } catch (\Throwable $e) {
            Log::error('[CodeMartV1Escrow] release failed for task ' . $task->id . ': ' . $e->getMessage());
            return ['released' => false, 'amount' => $amount, 'error_code' => 'escrow_release_failed'];
        }

        $payment = $result['payment'];
        if (!$result['replayed']) {
            CodeMartV1DomainEventService::emit(
                $approverId,
                'task',
                (int) $task->id,
                'escrow_released',
                null,
                null,
                [$developerId],
                CodeMartV1Constants::NOTIFICATION_TYPE_FINANCE,
                'notifications.escrowReleased',
                'notifications.escrowReleasedBody',
                [
                    'amount' => (string) $payment->amount,
                    'gross' => $amount,
                    'commission' => $result['commission'],
                    'payment_id' => (int) $payment->id,
                    'project_id' => $projectId,
                ]
            );
        }

        return [
            'released' => true,
            'amount' => $amount,
            'error_code' => null,
            'net_amount' => (string) $payment->amount,
            'commission' => $result['commission'],
            'payment_id' => (int) $payment->id,
            'replayed' => $result['replayed'],
        ];
    }
}
