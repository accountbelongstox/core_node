import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmPaymentCounterparty } from '../../api/CmApiTypes';
import { useCmPaymentDetail } from '../../shared/useCmWalletActions';
import { CmErrorState, CmLoadingState } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { useCmFormat } from './cmWorkspaceFormat';

export function cmPaymentPartyLabel(party: CmPaymentCounterparty | null | undefined, fallbackId: number | undefined, unknown: string): string {
  if (party) return party.name || party.nickname || party.username || `#${party.id}`;
  return fallbackId ? `#${fallbackId}` : unknown;
}

interface CmPaymentDetailPanelProps {
  paymentId: number;
  onClose: () => void;
}

/** Full record of one payment (`GET /payments/{id}`), visible to its payer and payee. */
export const CmPaymentDetailPanel: React.FC<CmPaymentDetailPanelProps> = ({ paymentId, onClose }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { payment, loading, error, retryable, reload } = useCmPaymentDetail(paymentId);

  return (
    <section className="cm-section-card cm-payment-detail" aria-label={t('wallet.paymentDetail.title', { id: paymentId })}>
      <div className="cm-payment-detail__head">
        <h3>{t('wallet.paymentDetail.title', { id: paymentId })}</h3>
        <button type="button" className="cm-workspace-button is-small" onClick={onClose} aria-label={t('common.close')}>
          <X aria-hidden="true" />
        </button>
      </div>
      {loading ? (
        <CmLoadingState compact />
      ) : error || !payment ? (
        <CmErrorState compact message={error ?? t('wallet.paymentDetail.loadFailed')} onRetry={retryable ? () => void reload() : undefined} />
      ) : (
        <dl className="cm-kv">
          <div><dt>{t('wallet.columnAmount')}</dt><dd>{format.money(payment.amount, payment.currency)}</dd></div>
          <div><dt>{t('wallet.columnStatus')}</dt><dd><CmStatusBadge group="payment" status={payment.status} /></dd></div>
          <div><dt>{t('wallet.columnType')}</dt><dd>{payment.type ? t(`wallet.paymentTypes.${payment.type}`, { defaultValue: payment.type }) : t('common.unavailable')}</dd></div>
          <div><dt>{t('wallet.columnMethod')}</dt><dd>{payment.payment_method ? t(`wallet.methods.${payment.payment_method}`, { defaultValue: payment.payment_method }) : t('common.unavailable')}</dd></div>
          <div><dt>{t('wallet.paymentDetail.payer')}</dt><dd>{cmPaymentPartyLabel(payment.payer, payment.payer_id, t('common.unavailable'))}</dd></div>
          <div><dt>{t('wallet.paymentDetail.payee')}</dt><dd>{cmPaymentPartyLabel(payment.payee, payment.payee_id, t('common.unavailable'))}</dd></div>
          {payment.project_id ? <div><dt>{t('wallet.paymentCreate.project')}</dt><dd>#{payment.project_id}</dd></div> : null}
          {payment.description ? <div><dt>{t('wallet.paymentCreate.description')}</dt><dd>{payment.description}</dd></div> : null}
          <div><dt>{t('wallet.columnDate')}</dt><dd>{format.date(payment.created_at) || t('common.unavailable')}</dd></div>
        </dl>
      )}
    </section>
  );
};

export default CmPaymentDetailPanel;
