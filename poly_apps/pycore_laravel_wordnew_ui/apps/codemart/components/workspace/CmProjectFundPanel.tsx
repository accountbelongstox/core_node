import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmProjectDetail, CmWallet } from '../../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../../api/cmErrors';
import { useCmIdempotencyKey } from '../../api/useCmIdempotencyKey';
import { CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { useCmFormat } from './cmWorkspaceFormat';

const APPROVED_PROPOSAL_STATUS = 'approved';
const INSUFFICIENT_BALANCE = 'insufficient_balance';

interface CmProjectFundPanelProps {
  project: CmProjectDetail;
  onFunded: () => Promise<void>;
}

/** Owner funds the accepted proposal into escrow; the server moves the project to open. */
export const CmProjectFundPanel: React.FC<CmProjectFundPanelProps> = ({ project, onFunded }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const notice = useCmNotice();
  const [fundingAmount, setFundingAmount] = useState<string | null>(null);
  const [wallet, setWallet] = useState<CmWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [needsTopUp, setNeedsTopUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([cmApi.getProjectAnalysis(project.id), cmApi.getWallet()]).then(([analysisResponse, walletResponse]) => {
      if (cancelled) return;
      const proposal = analysisResponse.success ? analysisResponse.data?.proposal ?? null : null;
      const proposalAmount = proposal && proposal.status === APPROVED_PROPOSAL_STATUS && proposal.estimated_cost && Number(proposal.estimated_cost) > 0
        ? proposal.estimated_cost
        : null;
      setFundingAmount(proposalAmount ?? project.budget);
      if (walletResponse.success && walletResponse.data) setWallet(walletResponse.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.budget]);

  const shortfall = wallet && fundingAmount !== null && Number(wallet.available_balance) < Number(fundingAmount);

  const fund = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    notice.clear();
    setNeedsTopUp(false);
    const response = await cmApi.fundProject(project.id, idempotency.current());
    setBusy(false);
    setConfirming(false);
    if (response.success && response.data) {
      idempotency.reset();
      notice.success(t('funding.funded', { amount: format.money(response.data.escrow.amount, response.data.escrow.currency ?? project.currency) }));
      await onFunded();
      return;
    }
    setNeedsTopUp(cmErrorCode(response) === INSUFFICIENT_BALANCE);
    notice.error(cmErrorMessage(t, response, 'funding.failed'));
  };

  return (
    <section className="cm-section-card cm-section-card--accent">
      <h2><Landmark aria-hidden="true" /> {t('funding.title')}</h2>
      <p className="cm-section-card__lead">{t('funding.description')}</p>
      {loading ? (
        <CmLoadingState compact />
      ) : (
        <>
          <dl className="cm-kv">
            <div><dt>{t('funding.amountLabel')}</dt><dd>{fundingAmount !== null ? format.money(fundingAmount, project.currency) : t('common.unavailable')}</dd></div>
            {wallet && <div><dt>{t('funding.availableLabel')}</dt><dd>{format.money(wallet.available_balance, wallet.currency)}</dd></div>}
          </dl>
          {shortfall && <CmNotice notice={{ tone: 'info', text: t('funding.topUpHint') }} />}
          <div className="cm-table-actions cm-section-card__actions">
            {!confirming ? (
              <button type="button" className="cm-workspace-button is-primary" disabled={busy || Boolean(shortfall)} onClick={() => setConfirming(true)}>
                {t('funding.fund')}
              </button>
            ) : (
              <>
                <span className="cm-confirm-inline">{t('funding.confirm', { amount: format.money(fundingAmount, project.currency) })}</span>
                <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void fund()}>
                  {busy ? t('funding.funding') : t('common.confirm')}
                </button>
                <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
              </>
            )}
            <Link to="/codemart/wallet" className="cm-workspace-button">
              <WalletCards aria-hidden="true" /> {t('funding.openWallet')}
            </Link>
          </div>
        </>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {needsTopUp && !shortfall && <CmNotice notice={{ tone: 'info', text: t('funding.topUpHint') }} />}
    </section>
  );
};

export default CmProjectFundPanel;
