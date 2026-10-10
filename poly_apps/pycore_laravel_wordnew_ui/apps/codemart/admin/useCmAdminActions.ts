import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import type { CmNoticeState } from '../components/workspace/CmStateViews';
import { cmAdminApi } from './CmAdminApi';
import { useCmAdminFormat } from './useCmAdminData';
import type {
  CmAdminContactMessageRow,
  CmAdminDepositRow,
  CmAdminDisputeResolution,
  CmAdminEscrowRefundResult,
  CmAdminEscrowRow,
  CmAdminKycRecord,
  CmAdminPaymentRow,
  CmAdminProjectRow,
  CmAdminRefundRow,
  CmAdminReviewerApplicationRow,
  CmAdminTestimonialRow,
  CmAdminUserRole,
  CmAdminUserSummary,
  CmAdminWithdrawalRow,
} from './CmAdminTypes';

export type CmAdminReasonMode = 'none' | 'optional' | 'required';

export interface CmAdminActionRequest {
  title: string;
  body?: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  reason?: CmAdminReasonMode;
  reasonLabel?: string;
  successKey: string;
  successText?: (data: unknown) => string;
  run: (reason: string) => Promise<APIResponse<unknown>>;
}

export interface CmAdminActionState {
  request: CmAdminActionRequest | null;
  ask: (request: CmAdminActionRequest) => void;
  close: () => void;
  /** Runs the pending action; resolves to an error message, or null once it succeeded and the list reloaded. */
  submit: (reason: string) => Promise<string | null>;
  notice: CmNoticeState | null;
  setNotice: (notice: CmNoticeState | null) => void;
}

/** Pending admin mutation (confirm dialog or sheet) with its reason handling and success notice. */
export function useCmAdminActionState(onDone: () => void | Promise<void>): CmAdminActionState {
  const { t } = useTranslation('cm');
  const [request, setRequest] = useState<CmAdminActionRequest | null>(null);
  const [notice, setNotice] = useState<CmNoticeState | null>(null);

  const close = useCallback(() => setRequest(null), []);

  const submit = useCallback(async (reason: string): Promise<string | null> => {
    if (!request) return null;
    const response = await request.run(reason);
    if (!response.success) {
      return cmErrorMessage(t, response, 'admin.actionFailed');
    }
    setNotice({ tone: 'success', text: request.successText ? request.successText(response.data) : t(request.successKey) });
    setRequest(null);
    await onDone();
    return null;
  }, [onDone, request, t]);

  return { request, ask: setRequest, close, submit, notice, setNotice };
}

/** Display name used inside confirmation sentences. */
export function useCmAdminUserName() {
  const { t } = useTranslation('cm');
  return (user: CmAdminUserSummary | null | undefined, userId?: number | null): string =>
    user?.username || user?.name || (userId ? t('admin.userNumber', { id: userId }) : t('admin.unknownUser'));
}

/**
 * The confirmation request of every console mutation (texts, reason rules and API call),
 * shared by the web console dialog and the mobile action sheet.
 */
export function useCmAdminActionBuilders(ask: (request: CmAdminActionRequest) => void) {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const userName = useCmAdminUserName();
  const { policyList, stateRule, terminalStates } = useCmBootstrap();
  const reasonRequiredRoleStates = stateRule('role_reason_required');
  const closedProjectStates = terminalStates('project');

  const approveKyc = (item: CmAdminKycRecord): void => ask({
    title: t('admin.kyc.approveTitle', { name: item.real_name }),
    body: t('admin.kyc.approveBody', { user: item.user?.username ?? t('admin.userNumber', { id: item.user_id }) }),
    confirmLabel: t('admin.approve'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.kyc.approved',
    run: (notes) => cmAdminApi.approveKyc(item.id, notes),
  });

  const rejectKyc = (item: CmAdminKycRecord): void => ask({
    title: t('admin.kyc.rejectTitle', { name: item.real_name }),
    body: t('admin.kyc.rejectBody', { user: item.user?.username ?? t('admin.userNumber', { id: item.user_id }) }),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.kyc.rejectReason'),
    successKey: 'admin.kyc.rejected',
    run: (notes) => cmAdminApi.rejectKyc(item.id, notes),
  });

  const depositParams = (item: CmAdminDepositRow) => ({
    id: item.id,
    amount: format.money(item.amount),
    user: userName(item.user, item.user_id),
    role: t(`roles.${item.role_type}`, { defaultValue: item.role_type }),
  });

  const confirmDeposit = (item: CmAdminDepositRow): void => ask({
    title: t('admin.deposits.confirmTitle', depositParams(item)),
    body: t('admin.deposits.confirmBody', depositParams(item)),
    confirmLabel: t('admin.confirmDeposit'),
    successKey: 'admin.depositConfirmed',
    run: () => cmAdminApi.confirmDeposit(item.id),
  });

  const rejectDeposit = (item: CmAdminDepositRow): void => ask({
    title: t('admin.deposits.rejectTitle', depositParams(item)),
    body: t('admin.deposits.rejectBody', depositParams(item)),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.deposits.rejected',
    run: (notes) => cmAdminApi.rejectDeposit(item.id, notes),
  });

  const refundDeposit = (item: CmAdminDepositRow): void => ask({
    title: t('admin.deposits.refundTitle', depositParams(item)),
    body: t('admin.deposits.refundBody', depositParams(item)),
    confirmLabel: t('admin.deposits.refund'),
    tone: 'danger',
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.deposits.refunded',
    run: (notes) => cmAdminApi.refundDeposit(item.id, notes),
  });

  const refundParams = (item: CmAdminRefundRow) => ({
    id: item.id,
    payment: item.payment_id,
    amount: format.money(item.amount, item.currency),
    payer: userName(item.payer),
    payee: userName(item.payee),
    requester: userName(item.requester, item.requested_by),
  });

  const approveRefund = (item: CmAdminRefundRow): void => ask({
    title: t('admin.refunds.approveTitle', refundParams(item)),
    body: t('admin.refunds.approveBody', refundParams(item)),
    confirmLabel: t('admin.approve'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.refunds.approved',
    run: (notes) => cmAdminApi.approveRefund(item.id, notes),
  });

  const rejectRefund = (item: CmAdminRefundRow): void => ask({
    title: t('admin.refunds.rejectTitle', refundParams(item)),
    body: t('admin.refunds.rejectBody', refundParams(item)),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.refunds.rejected',
    run: (notes) => cmAdminApi.rejectRefund(item.id, notes),
  });

  const processRefund = (item: CmAdminRefundRow): void => ask({
    title: t('admin.refunds.processTitle', refundParams(item)),
    body: t('admin.refunds.processBody', refundParams(item)),
    confirmLabel: t('admin.refunds.process'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.refunds.processed',
    run: (notes) => cmAdminApi.processRefund(item.id, notes),
  });

  const withdrawalParams = (item: CmAdminWithdrawalRow) => ({
    id: item.id,
    amount: format.money(item.amount, item.currency),
    user: userName(item.user),
  });

  const approveWithdrawal = (item: CmAdminWithdrawalRow): void => ask({
    title: t('admin.withdrawals.approveTitle', withdrawalParams(item)),
    body: t('admin.withdrawals.approveBody', withdrawalParams(item)),
    confirmLabel: t('admin.approve'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.withdrawals.approved',
    run: (notes) => cmAdminApi.approveWithdrawal(item.id, notes),
  });

  const rejectWithdrawal = (item: CmAdminWithdrawalRow): void => ask({
    title: t('admin.withdrawals.rejectTitle', withdrawalParams(item)),
    body: t('admin.withdrawals.rejectBody', withdrawalParams(item)),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.withdrawals.rejected',
    run: (notes) => cmAdminApi.rejectWithdrawal(item.id, notes),
  });

  const payWithdrawal = (item: CmAdminWithdrawalRow): void => ask({
    title: t('admin.withdrawals.payTitle', withdrawalParams(item)),
    body: t('admin.withdrawals.payBody', withdrawalParams(item)),
    confirmLabel: t('admin.withdrawals.pay'),
    reason: 'optional',
    reasonLabel: t('admin.withdrawals.payNotes'),
    successKey: 'admin.withdrawals.paid',
    run: (notes) => cmAdminApi.payWithdrawal(item.id, notes),
  });

  const resolveDispute = (item: CmAdminPaymentRow, resolution: CmAdminDisputeResolution): void => {
    const params = {
      id: item.id,
      amount: format.money(item.amount, item.currency),
      payer: userName(item.payer),
      payee: userName(item.payee),
    };
    ask({
      title: t(`admin.payments.resolve.${resolution}Title`, params),
      body: t(`admin.payments.resolve.${resolution}Body`, params),
      confirmLabel: t(`admin.payments.resolve.${resolution}`),
      tone: resolution === 'refund' ? 'danger' : 'primary',
      reason: 'optional',
      reasonLabel: t('admin.dialog.notes'),
      successKey: 'admin.payments.resolved',
      run: (notes) => cmAdminApi.resolveDispute(item.id, resolution, notes),
    });
  };

  const refundEscrow = (item: CmAdminEscrowRow): void => {
    const params = { id: item.id, amount: format.money(item.remaining_amount, item.currency), payer: userName(item.payer) };
    ask({
      title: t('admin.payments.escrowRefund.title', params),
      body: t('admin.payments.escrowRefund.body', params),
      confirmLabel: t('admin.payments.escrowRefund.action'),
      tone: 'danger',
      reason: 'optional',
      reasonLabel: t('admin.dialog.notes'),
      successKey: 'admin.payments.escrowRefund.nothingLeft',
      successText: (data) => {
        const result = data as CmAdminEscrowRefundResult | null;
        return result && !result.replayed
          ? t('admin.payments.escrowRefund.done', { amount: format.money(result.refunded_amount, item.currency) })
          : t('admin.payments.escrowRefund.nothingLeft');
      },
      run: (notes) => cmAdminApi.refundEscrow(item.id, notes),
    });
  };

  const setProjectStatus = (item: CmAdminProjectRow, target: string): void => {
    const targetLabel = t(`states.project.${target}`, { defaultValue: target });
    ask({
      title: t('admin.projects.changeTitle', { title: item.title, status: targetLabel }),
      body: t('admin.projects.changeBody', {
        from: t(`states.project.${item.status}`, { defaultValue: item.status }),
        to: targetLabel,
        client: userName(item.client, item.client_id),
        effect: t(`admin.projects.effect.${target}`, { defaultValue: '' }),
      }),
      confirmLabel: t(`admin.projects.action.${target}`, { defaultValue: targetLabel }),
      tone: closedProjectStates.includes(target) ? 'danger' : 'primary',
      reason: 'required',
      successKey: 'admin.projects.updated',
      run: (reason) => cmAdminApi.setProjectStatus(item.id, target, reason),
    });
  };

  const moderateTestimonial = (item: CmAdminTestimonialRow, approve: boolean, author: string): void => ask({
    title: t(approve ? 'admin.testimonials.approveTitle' : 'admin.testimonials.hideTitle', { author }),
    body: t(approve ? 'admin.testimonials.approveBody' : 'admin.testimonials.hideBody'),
    confirmLabel: t(approve ? 'admin.testimonials.publish' : 'admin.testimonials.hide'),
    tone: approve ? 'primary' : 'danger',
    successKey: approve ? 'admin.testimonials.approved' : 'admin.testimonials.hidden',
    run: () => (approve ? cmAdminApi.approveTestimonial(item.id) : cmAdminApi.hideTestimonial(item.id)),
  });

  const revokeReviewer = (item: CmAdminReviewerApplicationRow): void => ask({
    title: t('admin.reviewers.revokeTitle', { user: item.user?.username ?? t('admin.userNumber', { id: item.user_id }) }),
    body: t('admin.reviewers.revokeBody'),
    confirmLabel: t('admin.reviewers.revoke'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.reviewers.revoked',
    run: (reason) => cmAdminApi.revokeReviewer(item.id, reason),
  });

  const handleContact = (item: CmAdminContactMessageRow): void => ask({
    title: t('admin.contact.handleTitle', { name: item.name }),
    body: t('admin.contact.handleBody', { email: item.email }),
    confirmLabel: t('admin.contact.handle'),
    successKey: 'admin.contact.handled',
    run: () => cmAdminApi.handleContactMessage(item.id),
  });

  const changeRoleStatus = (userId: number, username: string | null | undefined, role: CmAdminUserRole, target: string): void => {
    const reasonRequired = reasonRequiredRoleStates.includes(target);
    const roleLabel = t(`roles.${role.role_type}`, { defaultValue: role.role_type });
    const targetLabel = t(`states.role.${target}`, { defaultValue: target });
    ask({
      title: t('admin.userDetail.changeRoleTitle', { role: roleLabel, status: targetLabel }),
      body: t('admin.userDetail.changeRoleBody', {
        user: username ?? userId,
        from: t(`states.role.${role.role_status}`, { defaultValue: role.role_status }),
        to: targetLabel,
        effect: t(`admin.userDetail.effect.${target}`, { defaultValue: '' }),
      }),
      confirmLabel: t(`admin.userDetail.transition.${target}`, { defaultValue: targetLabel }),
      tone: reasonRequired ? 'danger' : 'primary',
      reason: reasonRequired ? 'required' : 'optional',
      successKey: 'admin.roleUpdated',
      run: (reason) => cmAdminApi.setRoleStatus(userId, role.role_type, target, reason),
    });
  };

  const grantRole = (userId: number, username: string | null | undefined, roleType: string, status: string, onGranted: () => void): void => ask({
    title: t('admin.userDetail.grantTitle', { role: t(`roles.${roleType}`, { defaultValue: roleType }) }),
    body: t('admin.userDetail.grantBody', { user: username ?? userId, status: t(`states.role.${status}`) }),
    confirmLabel: t('admin.userDetail.grant'),
    reason: 'optional',
    successKey: 'admin.userDetail.granted',
    run: async (reason) => {
      const response = await cmAdminApi.grantRole(userId, roleType, status, reason);
      if (response.success) onGranted();
      return response;
    },
  });

  return {
    userName,
    disputeResolutions: policyList('dispute_resolutions'),
    reasonRequiredRoleStates,
    closedProjectStates,
    approveKyc,
    rejectKyc,
    confirmDeposit,
    rejectDeposit,
    refundDeposit,
    approveRefund,
    rejectRefund,
    processRefund,
    approveWithdrawal,
    rejectWithdrawal,
    payWithdrawal,
    resolveDispute,
    refundEscrow,
    setProjectStatus,
    moderateTestimonial,
    revokeReviewer,
    handleContact,
    changeRoleStatus,
    grantRole,
  };
}
