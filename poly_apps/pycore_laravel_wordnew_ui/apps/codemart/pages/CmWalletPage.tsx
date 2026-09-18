import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmWallet, CmWalletTransaction } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

function parseTransactions(data: unknown): CmWalletTransaction[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { items?: unknown };
  return Array.isArray(source.items) ? (source.items as CmWalletTransaction[]) : [];
}

export const CmWalletPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const [wallet, setWallet] = useState<CmWallet | null>(null);
  const [transactions, setTransactions] = useState<CmWalletTransaction[]>([]);
  const [depositInfo, setDepositInfo] = useState<{ required_deposit: number; current_deposit: number; is_sufficient: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [walletResponse, transactionsResponse, depositResponse] = await Promise.all([
      cmApi.getWallet(),
      cmApi.getWalletTransactions(),
      cmApi.getDepositInfo(),
    ]);
    if (walletResponse.success && walletResponse.data) {
      setWallet(walletResponse.data);
    }
    if (transactionsResponse.success) {
      setTransactions(parseTransactions(transactionsResponse.data));
    }
    if (depositResponse.success && depositResponse.data) {
      setDepositInfo(depositResponse.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('wallet.eyebrow')}</span>
        <h1>{t('nav.wallet')}</h1>
        <p>{t('wallet.description')}</p>
        <button type="button" className="cm-workspace-button" onClick={() => { void load(); void refresh(); }}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </header>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : (
        <>
          <section className="cm-metric-grid">
            <article className="cm-metric-card" data-tone="green">
              <span><WalletCards aria-hidden="true" /></span>
              <div>
                <strong>{wallet ? `${wallet.currency} ${wallet.available_balance}` : t('common.unavailable')}</strong>
                <small>{t('wallet.available')}</small>
              </div>
            </article>
            <article className="cm-metric-card" data-tone="blue">
              <span><WalletCards aria-hidden="true" /></span>
              <div>
                <strong>{wallet ? `${wallet.currency} ${wallet.balance}` : t('common.unavailable')}</strong>
                <small>{t('wallet.balance')}</small>
              </div>
            </article>
            <article className="cm-metric-card" data-tone="amber">
              <span><WalletCards aria-hidden="true" /></span>
              <div>
                <strong>{wallet ? `${wallet.currency} ${wallet.frozen_balance}` : t('common.unavailable')}</strong>
                <small>{t('wallet.frozen')}</small>
              </div>
            </article>
          </section>

          {depositInfo && (
            <section className="cm-dashboard-section">
              <h2>{t('wallet.depositTitle')}</h2>
              <p className="cm-contract-note">
                {t('wallet.depositSummary', {
                  current: depositInfo.current_deposit,
                  required: depositInfo.required_deposit,
                })}
                {' '}
                {depositInfo.is_sufficient ? t('wallet.depositSufficient') : t('wallet.depositShortfall')}
              </p>
            </section>
          )}

          <section className="cm-dashboard-section">
            <h2>{t('wallet.transactionsTitle')}</h2>
            {transactions.length === 0 ? (
              <p className="cm-contract-note">{t('wallet.noTransactions')}</p>
            ) : (
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>{t('wallet.columnType')}</th>
                    <th>{t('wallet.columnAmount')}</th>
                    <th>{t('wallet.columnBalanceAfter')}</th>
                    <th>{t('wallet.columnStatus')}</th>
                    <th>{t('wallet.columnDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.type}</td>
                      <td>{transaction.amount}</td>
                      <td>{transaction.balance_after ?? t('common.unavailable')}</td>
                      <td><span className="cm-status" data-status={transaction.status}>{transaction.status}</span></td>
                      <td>{transaction.created_at ? transaction.created_at.slice(0, 10) : t('common.unavailable')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
};

export default CmWalletPage;
