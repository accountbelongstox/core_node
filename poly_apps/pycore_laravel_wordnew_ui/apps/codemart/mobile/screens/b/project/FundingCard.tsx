import React, { useState } from 'react';
import { Landmark, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../../../../api/CmApiTypes';
import { CM_PROTECTED_ROUTE } from '../../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmProjectFunding } from '../../../../shared/useCmProjectFunding';
import { MobileButton, MobileCard, MobileNotice, MobileSkeletonBlock, useMobileFeedback, MobileConfirmSheet, MobileKeyValues } from '../../../ui';

/** Owner funds the accepted proposal into escrow; the server moves the project to open and answers insufficient_balance with a top-up hint. */
export const FundingCard: React.FC<{ project: CmProjectDetail; onFunded: () => Promise<void> }> = ({ project, onFunded }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const funding = useCmProjectFunding(project, onFunded, feedback);
  const { fundingAmount, wallet, loading, busy, shortfall, needsTopUp } = funding;
  const [confirming, setConfirming] = useState(false);
  const topUp = shortfall || needsTopUp;

  const fund = async (): Promise<void> => {
    await funding.fund();
    setConfirming(false);
  };

  return (
    <MobileCard tone="accent">
      <h3 className="cmm-card-title"><Landmark aria-hidden="true" /> {t('funding.title')}</h3>
      <p className="cmm-card-lead">{t('funding.description')}</p>
      {loading ? <MobileSkeletonBlock height={64} /> : (
        <div className="cmm-stack-tight">
          <MobileKeyValues
            items={[
              { label: t('funding.amountLabel'), value: fundingAmount !== null ? format.money(fundingAmount, project.currency) : t('common.unavailable') },
              wallet && { label: t('funding.availableLabel'), value: format.money(wallet.available_balance, wallet.currency) },
            ]}
          />
          {topUp && <MobileNotice>{t('funding.topUpHint')}</MobileNotice>}
          <div className="cmm-row-actions">
            <MobileButton variant="primary" disabled={busy || shortfall} onClick={() => setConfirming(true)}>{t('funding.fund')}</MobileButton>
            <MobileButton icon={<WalletCards aria-hidden="true" />} to={topUp ? `${CM_PROTECTED_ROUTE.wallet}?tab=deposits` : CM_PROTECTED_ROUTE.wallet}>
              {topUp ? t('funding.openWalletDeposits') : t('funding.openWallet')}
            </MobileButton>
          </div>
        </div>
      )}
      <MobileConfirmSheet
        open={confirming}
        title={t('funding.title')}
        message={t('funding.confirm', { amount: format.money(fundingAmount, project.currency) })}
        confirmLabel={busy ? t('funding.funding') : t('funding.fund')}
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={fund}
      />
    </MobileCard>
  );
};
