import React from 'react';
import { FileText, Undo2 } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { cmPaymentPartyLabel } from '../../../../components/workspace/CmPaymentDetailPanel';
import { useCmPaymentActions, useCmPaymentDetail } from '../../../../shared/useCmWalletActions';
import { MobileButton, MobileErrorState, MobileField, MobileSheet, MobileSkeletonBlock, MobileStatusBadge } from '../../../ui';
import { MobileKeyValues } from '../parts/MobileKeyValues';
import { useInlineFeedback } from '../parts/useInlineFeedback';

interface WalletPaymentSheetProps {
  paymentId: number | null;
  userId: number | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const PaymentBody: React.FC<{ paymentId: number; userId: number | null; onClose: () => void; onChanged: () => Promise<void> }> = ({ paymentId, userId, onClose, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { feedback, notice, clear } = useInlineFeedback();
  const detail = useCmPaymentDetail(paymentId);
  const actions = useCmPaymentActions(feedback, async () => {
    await onChanged();
    clear();
    onClose();
  });
  const { payment } = detail;

  if (detail.loading) return <MobileSkeletonBlock height={160} />;
  if (detail.error || !payment) return <MobileErrorState message={detail.error ?? t('wallet.paymentDetail.loadFailed')} onRetry={detail.retryable ? () => void detail.reload() : undefined} />;

  const isPayer = userId !== null && payment.payer_id === userId;
  const isPayee = userId !== null && payment.payee_id === userId;
  const canRefund = isPayer && actions.refundableStates.includes(payment.status);
  const refunding = actions.refundPaymentId === payment.id;
  const unavailable = t('common.unavailable');

  return (
    <div className="cmmc-form">
      <MobileKeyValues
        items={[
          { label: t('wallet.columnAmount'), value: format.money(payment.amount, payment.currency) },
          { label: t('wallet.columnStatus'), value: <MobileStatusBadge group="payment" status={payment.status} /> },
          { label: t('wallet.columnType'), value: payment.type ? t(`wallet.paymentTypes.${payment.type}`, { defaultValue: payment.type }) : unavailable },
          { label: t('wallet.columnMethod'), value: payment.payment_method ? t(`wallet.methods.${payment.payment_method}`, { defaultValue: payment.payment_method }) : unavailable },
          { label: t('wallet.paymentDetail.payer'), value: cmPaymentPartyLabel(payment.payer, payment.payer_id, unavailable) },
          { label: t('wallet.paymentDetail.payee'), value: cmPaymentPartyLabel(payment.payee, payment.payee_id, unavailable) },
          payment.project_id ? { label: t('wallet.paymentCreate.project'), value: `#${payment.project_id}` } : null,
          payment.description ? { label: t('wallet.paymentCreate.description'), value: payment.description } : null,
          { label: t('wallet.columnDate'), value: format.dateTime(payment.created_at) || unavailable },
        ]}
      />
      {refunding && (
        <>
          <MobileField label={t('wallet.columnReason')}>
            <textarea className="cmm-input cmmc-textarea" rows={3} value={actions.refundReason} placeholder={t('wallet.refundReasonPlaceholder')} onChange={(event) => actions.setRefundReason(event.target.value)} />
          </MobileField>
          <div className="cmmc-row-actions">
            <MobileButton variant="ghost" onClick={() => actions.openRefund(null)}>{t('common.cancel')}</MobileButton>
            <MobileButton variant="primary" loading={actions.busy} disabled={!actions.refundReason.trim()} onClick={() => void actions.requestRefund(payment.id)}>{t('wallet.refundSend')}</MobileButton>
          </div>
        </>
      )}
      {!refunding && (isPayee || canRefund) && (
        <div className="cmmc-row-actions">
          {isPayee && <MobileButton icon={<FileText aria-hidden="true" />} loading={actions.busy} onClick={() => void actions.createInvoice(payment.id)}>{t('wallet.createInvoice')}</MobileButton>}
          {canRefund && <MobileButton icon={<Undo2 aria-hidden="true" />} onClick={() => actions.openRefund(payment.id)}>{t('wallet.requestRefund')}</MobileButton>}
        </div>
      )}
      {notice}
    </div>
  );
};

/** One payment (`GET /payments/{id}`) with the actions its payer (refund) and payee (invoice) have. */
export const WalletPaymentSheet: React.FC<WalletPaymentSheetProps> = ({ paymentId, userId, onClose, onChanged }) => {
  const { t } = useTranslation('cm');
  return (
    <MobileSheet open={paymentId !== null} onClose={onClose} title={paymentId !== null ? t('wallet.paymentDetail.title', { id: paymentId }) : ''}>
      {paymentId !== null && <PaymentBody paymentId={paymentId} userId={userId} onClose={onClose} onChanged={onChanged} />}
    </MobileSheet>
  );
};
