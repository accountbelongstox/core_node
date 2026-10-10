import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmPaymentCounterparty, CmPaymentDetail } from '../../api/CmApiTypes';
import { cmErrorMessage } from '../../api/cmErrors';
import { CmErrorState, CmLoadingState } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { useCmFormat } from './cmWorkspaceFormat';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

function partyLabel(party: CmPaymentCounterparty | null | undefined, fallbackId: number | undefined, unknown: string): string {
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
  const [payment, setPayment] = useState<CmPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getPayment(paymentId);
    if (response.success && response.data) {
      setPayment(response.data);
      setError(null);
    } else {
      setPayment(null);
      setError(cmErrorMessage(t, response, 'wallet.paymentDetail.loadFailed'));
      setRetryable(response.status !== HTTP_FORBIDDEN && response.status !== HTTP_NOT_FOUND);
    }
    setLoading(false);
  }, [paymentId, t]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <CmErrorState compact message={error ?? t('wallet.paymentDetail.loadFailed')} onRetry={retryable ? () => void load() : undefined} />
      ) : (
        <dl className="cm-kv">
          <div><dt>{t('wallet.columnAmount')}</dt><dd>{format.money(payment.amount, payment.currency)}</dd></div>
          <div><dt>{t('wallet.columnStatus')}</dt><dd><CmStatusBadge group="payment" status={payment.status} /></dd></div>
          <div><dt>{t('wallet.columnType')}</dt><dd>{payment.type ? t(`wallet.paymentTypes.${payment.type}`, { defaultValue: payment.type }) : t('common.unavailable')}</dd></div>
          <div><dt>{t('wallet.columnMethod')}</dt><dd>{payment.payment_method ? t(`wallet.methods.${payment.payment_method}`, { defaultValue: payment.payment_method }) : t('common.unavailable')}</dd></div>
          <div><dt>{t('wallet.paymentDetail.payer')}</dt><dd>{partyLabel(payment.payer, payment.payer_id, t('common.unavailable'))}</dd></div>
          <div><dt>{t('wallet.paymentDetail.payee')}</dt><dd>{partyLabel(payment.payee, payment.payee_id, t('common.unavailable'))}</dd></div>
          {payment.project_id ? <div><dt>{t('wallet.paymentCreate.project')}</dt><dd>#{payment.project_id}</dd></div> : null}
          {payment.description ? <div><dt>{t('wallet.paymentCreate.description')}</dt><dd>{payment.description}</dd></div> : null}
          <div><dt>{t('wallet.columnDate')}</dt><dd>{format.date(payment.created_at) || t('common.unavailable')}</dd></div>
        </dl>
      )}
    </section>
  );
};

export default CmPaymentDetailPanel;
