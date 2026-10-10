import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Send } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmPolicy } from '../../../contexts/useCmPolicy';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmWallet } from '../../../shared/useCmWallet';
import { useCmWalletTab } from '../../../shared/useCmWalletTab';
import { MobileButton, MobileErrorState, MobileScreen, MobileSkeletonBlock } from '../../ui';
import { MobilePills } from './parts/MobilePills';
import { WalletDepositsPanel } from './wallet/WalletDepositsPanel';
import {
  WalletInvoicesPanel,
  WalletPaymentsPanel,
  WalletRefundsPanel,
  WalletTransactionsPanel,
  WalletWithdrawalsPanel,
} from './wallet/WalletListPanels';
import { WalletPaymentCreateSheet } from './wallet/WalletPaymentCreateSheet';
import { WalletPaymentSheet } from './wallet/WalletPaymentSheet';
import { WalletTopUpSheet } from './wallet/WalletTopUpSheet';
import { WalletWithdrawalSheet } from './wallet/WalletWithdrawalSheet';

/** Mobile wallet: balances with quick actions, then the ledger, deposits, payments, invoices, refunds and withdrawals. */
const MobileWalletScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap } = useCmBootstrap();
  const { paymentMethods, paymentCreatableTypes } = useCmPolicy();
  const { tab, tabs, setTab, canWithdraw } = useCmWalletTab();
  const { wallet, loading, error, currency, balances, reload } = useCmWallet();
  const [refreshToken, setRefreshToken] = useState(0);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const userId = bootstrap?.user.id ?? null;
  const canPay = paymentMethods.length > 0 && paymentCreatableTypes.length > 0;
  const balanceOf = (key: string): string => balances.find((item) => item.key === key)?.value ?? '0';

  const changed = async (): Promise<void> => {
    await reload();
    setRefreshToken((value) => value + 1);
  };

  const openWithdraw = (): void => {
    setTab('withdrawals');
    setWithdrawOpen(true);
  };

  return (
    <MobileScreen title={t('nav.wallet')} onRefresh={changed}>
      {loading && !wallet ? (
        <MobileSkeletonBlock height={150} />
      ) : error && !wallet ? (
        <MobileErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <section className="cmmc-balance" aria-label={t('wallet.balancesLabel')}>
          <span className="cmmc-balance__label">{t('wallet.available')}</span>
          <strong className="cmmc-balance__value">{format.money(balanceOf('available'), wallet?.currency ?? currency)}</strong>
          <div className="cmmc-balance__sub">
            <span><small>{t('wallet.frozen')}</small>{format.money(balanceOf('frozen'), wallet?.currency ?? currency)}</span>
            <span><small>{t('wallet.balance')}</small>{format.money(balanceOf('balance'), wallet?.currency ?? currency)}</span>
          </div>
          <div className="cmmc-balance__actions">
            <MobileButton variant="primary" small icon={<ArrowDownToLine aria-hidden="true" />} onClick={() => setTopUpOpen(true)}>{t('mobile.c.topUp')}</MobileButton>
            {canWithdraw && <MobileButton small icon={<ArrowUpFromLine aria-hidden="true" />} onClick={openWithdraw}>{t('mobile.c.withdraw')}</MobileButton>}
            {canPay && <MobileButton small icon={<Send aria-hidden="true" />} onClick={() => setPaymentOpen(true)}>{t('mobile.c.pay')}</MobileButton>}
          </div>
        </section>
      )}

      <MobilePills ariaLabel={t('nav.wallet')} value={tab} onChange={setTab} options={tabs.map((item) => ({ value: item, label: t(`wallet.tabs.${item}`) }))} />

      <div className="cmmc-panel" role="tabpanel">
        {tab === 'transactions' && <WalletTransactionsPanel currency={currency} refreshToken={refreshToken} />}
        {tab === 'deposits' && <WalletDepositsPanel onChanged={reload} refreshToken={refreshToken} />}
        {tab === 'payments' && <WalletPaymentsPanel userId={userId} onOpen={setPaymentId} refreshToken={refreshToken} />}
        {tab === 'invoices' && <WalletInvoicesPanel refreshToken={refreshToken} />}
        {tab === 'refunds' && <WalletRefundsPanel refreshToken={refreshToken} />}
        {tab === 'withdrawals' && canWithdraw && <WalletWithdrawalsPanel refreshToken={refreshToken} />}
      </div>

      <WalletTopUpSheet open={topUpOpen} currency={wallet?.currency ?? currency ?? ''} onClose={() => setTopUpOpen(false)} onCreated={changed} />
      <WalletWithdrawalSheet open={withdrawOpen} wallet={wallet} onClose={() => setWithdrawOpen(false)} onCreated={changed} />
      <WalletPaymentCreateSheet open={paymentOpen} onClose={() => setPaymentOpen(false)} onCreated={changed} />
      <WalletPaymentSheet paymentId={paymentId} userId={userId} onClose={() => setPaymentId(null)} onChanged={changed} />
    </MobileScreen>
  );
};

export default MobileWalletScreen;
