import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../../api/CmApiTypes';
import { useCmProjectFunding } from '../../shared/useCmProjectFunding';
import { CM_PROTECTED_ROUTE } from '../public-home/cmPublicRoutes';
import { CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { useCmFormat } from './cmWorkspaceFormat';

interface CmProjectFundPanelProps {
  project: CmProjectDetail;
  onFunded: () => Promise<void>;
}

/** Owner funds the accepted proposal into escrow; the server moves the project to open. */
export const CmProjectFundPanel: React.FC<CmProjectFundPanelProps> = ({ project, onFunded }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const funding = useCmProjectFunding(project, onFunded, notice);
  const { fundingAmount, wallet, loading, busy, shortfall, needsTopUp } = funding;
  const [confirming, setConfirming] = useState(false);

  const fund = async (): Promise<void> => {
    await funding.fund();
    setConfirming(false);
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
              <button type="button" className="cm-workspace-button is-primary" disabled={busy || shortfall} onClick={() => setConfirming(true)}>
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
            <Link to={shortfall || needsTopUp ? `${CM_PROTECTED_ROUTE.wallet}?tab=deposits` : CM_PROTECTED_ROUTE.wallet} className="cm-workspace-button">
              <WalletCards aria-hidden="true" /> {shortfall || needsTopUp ? t('funding.openWalletDeposits') : t('funding.openWallet')}
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
