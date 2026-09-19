import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmDepositInfo, CmDepositRecord, CmPayment, CmWallet, CmWalletTransaction } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

function parseTransactions(data: unknown): CmWalletTransaction[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { items?: unknown };
  return Array.isArray(source.items) ? (source.items as CmWalletTransaction[]) : [];
}

function parseDeposits(data: unknown): CmDepositRecord[] {
  if (Array.isArray(data)) return data as CmDepositRecord[];
  if (!data || typeof data !== 'object') return [];
  const source = data as { items?: unknown; deposits?: unknown };
  const list = Array.isArray(source.items) ? source.items : source.deposits;
  return Array.isArray(list) ? (list as CmDepositRecord[]) : [];
}

function parsePayments(data: unknown): CmPayment[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { items?: unknown };
  return Array.isArray(source.items) ? (source.items as CmPayment[]) : [];
}

const CmDepositPanel: React.FC<{ onChanged: () => Promise<void> }> = ({ onChanged }) => {
  const { t } = useTranslation('cm');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('alipay');
  const [history, setHistory] = useState<CmDepositRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadHistory = useCallback(async (): Promise<void> => {
    const response = await cmApi.getDepositHistory();
    if (response.success) {
      setHistory(parseDeposits(response.data));
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const createDeposit = async (): Promise<void> => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100 || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.createDeposit(value, method);
    if (response.success) {
      setNotice(t('wallet.depositCreated'));
      setAmount('');
      await loadHistory();
      await onChanged();
    } else {
      setNotice(response.error ?? t('wallet.depositFailed'));
    }
    setBusy(false);
  };

  return (
    <section className="cm-dashboard-section">
      <h2>{t('wallet.depositCreateTitle')}</h2>
      <div className="cm-task-comment-row">
        <input
          type="number"
          min={100}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={t('wallet.depositAmountPlaceholder')}
        />
        <select value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="alipay">{t('wallet.methods.alipay')}</option>
          <option value="wechat">{t('wallet.methods.wechat')}</option>
          <option value="bank_transfer">{t('wallet.methods.bankTransfer')}</option>
        </select>
        <button
          type="button"
          className="cm-workspace-button is-primary"
          disabled={busy || !amount}
          onClick={() => void createDeposit()}
        >
          {busy ? t('common.loading') : t('wallet.depositCreate')}
        </button>
      </div>
      {history.length > 0 && (
        <table className="cm-table">
          <thead>
            <tr>
              <th>{t('wallet.columnAmount')}</th>
              <th>{t('wallet.columnMethod')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
              <th>{t('wallet.columnPayment')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((deposit) => (
              <tr key={deposit.id}>
                <td>{deposit.amount}</td>
                <td>{t(`wallet.methods.${deposit.payment_method}`, { defaultValue: deposit.payment_method })}</td>
                <td><span className="cm-status" data-status={deposit.status}>{t(`states.payment.${deposit.status}`, { defaultValue: deposit.status })}</span></td>
                <td>{deposit.created_at ? deposit.created_at.slice(0, 10) : t('common.unavailable')}</td>
                <td>
                  {deposit.status === 'pending' && deposit.payment_url ? (
                    <a className="cm-workspace-link" href={deposit.payment_url} target="_blank" rel="noreferrer">
                      {t('wallet.payNow')}
                    </a>
                  ) : (
                    t('common.unavailable')
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {notice && <p className="cm-contract-note">{notice}</p>}
    </section>
  );
};

const CmPaymentsPanel: React.FC = () => {
  const { t } = useTranslation('cm');
  const [payments, setPayments] = useState<CmPayment[]>([]);
  const [refundPaymentId, setRefundPaymentId] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const response = await cmApi.getPayments();
    if (response.success) {
      setPayments(parsePayments(response.data));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requestRefund = async (paymentId: number): Promise<void> => {
    if (!refundReason.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.requestRefund({ payment_id: paymentId, reason: refundReason.trim() });
    if (response.success) {
      setNotice(t('wallet.refundRequested'));
      setRefundPaymentId(null);
      setRefundReason('');
    } else {
      setNotice(response.error ?? t('wallet.refundFailed'));
    }
    setBusy(false);
  };

  const createInvoice = async (paymentId: number): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.createInvoice({ payment_id: paymentId });
    setNotice(response.success ? t('wallet.invoiceCreated') : (response.error ?? t('wallet.invoiceFailed')));
    setBusy(false);
  };

  return (
    <section className="cm-dashboard-section">
      <h2>{t('wallet.paymentsTitle')}</h2>
      {payments.length === 0 ? (
        <p className="cm-contract-note">{t('wallet.noPayments')}</p>
      ) : (
        <table className="cm-table">
          <thead>
            <tr>
              <th>{t('wallet.columnAmount')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
              <th>{t('wallet.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.amount}</td>
                <td><span className="cm-status" data-status={payment.status}>{t(`states.payment.${payment.status}`, { defaultValue: payment.status })}</span></td>
                <td>{payment.created_at ? payment.created_at.slice(0, 10) : t('common.unavailable')}</td>
                <td>
                  <div className="cm-table-actions">
                    <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => void createInvoice(payment.id)}>
                      {t('wallet.createInvoice')}
                    </button>
                    {refundPaymentId === payment.id ? (
                      <span className="cm-table-actions__refund">
                        <input
                          value={refundReason}
                          onChange={(event) => setRefundReason(event.target.value)}
                          placeholder={t('wallet.refundReasonPlaceholder')}
                        />
                        <button
                          type="button"
                          className="cm-workspace-button is-primary"
                          disabled={busy || !refundReason.trim()}
                          onClick={() => void requestRefund(payment.id)}
                        >
                          {t('wallet.refundSend')}
                        </button>
                        <button type="button" className="cm-workspace-button" onClick={() => setRefundPaymentId(null)}>
                          {t('common.cancel')}
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="cm-workspace-button" onClick={() => setRefundPaymentId(payment.id)}>
                        {t('wallet.requestRefund')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {notice && <p className="cm-contract-note">{notice}</p>}
    </section>
  );
};

export const CmWalletPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const [wallet, setWallet] = useState<CmWallet | null>(null);
  const [transactions, setTransactions] = useState<CmWalletTransaction[]>([]);
  const [depositInfo, setDepositInfo] = useState<CmDepositInfo | null>(null);
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

          <CmDepositPanel onChanged={load} />
          <CmPaymentsPanel />

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
