import React, { useEffect } from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import {
  cmTransactionAmountStyle,
  useCmLedgerDescription,
  useCmWalletInvoices,
  useCmWalletPayments,
  useCmWalletRefunds,
  useCmWalletTransactions,
  useCmWalletWithdrawals,
} from '../../../../shared/useCmWallet';
import { MobileListRow, MobileStatusBadge, MobilePagedList } from '../../../ui';

interface WalletListPanelProps {
  refreshToken: number;
}

/** Reloads a paged list whenever the wallet reports a change (top-up, payment, withdrawal). */
function useReloadOnToken(reload: () => Promise<void>, refreshToken: number): void {
  useEffect(() => {
    if (refreshToken > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);
}

export const WalletTransactionsPanel: React.FC<WalletListPanelProps & { currency: string | null }> = ({ currency, refreshToken }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmWalletTransactions();
  const describe = useCmLedgerDescription();
  useReloadOnToken(list.reload, refreshToken);

  return (
    <>
      <p className="cmm-muted">{t('wallet.transactionsLead')}</p>
      <MobilePagedList
        list={list}
        emptyTitle={t('wallet.noTransactions')}
        label={t('wallet.tabs.transactions')}
        renderRow={(transaction) => {
          const { sign, tone, status } = cmTransactionAmountStyle(transaction);
          const balanceAfter = transaction.balance_after !== null ? `${t('wallet.columnBalanceAfter')} ${format.money(transaction.balance_after, currency)}` : null;
          return (
            <MobileListRow
              key={transaction.id}
              title={t(`wallet.transactionTypes.${transaction.type}`, { defaultValue: transaction.type })}
              subtitle={describe(transaction)}
              meta={[format.dateTime(transaction.created_at), balanceAfter].filter(Boolean).join(' · ')}
              trailing={(
                <span className="cmmc-trail">
                  <strong className="cmmc-amount" data-tone={tone}>{sign}{format.money(Math.abs(Number(transaction.amount)), currency)}</strong>
                  <MobileStatusBadge group="transaction" status={status} />
                </span>
              )}
            />
          );
        }}
      />
    </>
  );
};

export const WalletPaymentsPanel: React.FC<WalletListPanelProps & { userId: number | null; onOpen: (paymentId: number) => void }> = ({ userId, onOpen, refreshToken }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmWalletPayments();
  useReloadOnToken(list.reload, refreshToken);

  return (
    <>
      <p className="cmm-muted">{t('wallet.paymentsLead')}</p>
      <MobilePagedList
        list={list}
        emptyTitle={t('wallet.noPayments')}
        label={t('wallet.tabs.payments')}
        renderRow={(payment) => (
          <MobileListRow
            key={payment.id}
            title={payment.type ? t(`wallet.paymentTypes.${payment.type}`, { defaultValue: payment.type }) : t('common.unavailable')}
            subtitle={userId !== null && payment.payer_id === userId ? t('wallet.outgoing') : t('wallet.incoming')}
            meta={format.date(payment.created_at)}
            trailing={<span className="cmmc-trail"><strong>{format.money(payment.amount, payment.currency)}</strong><MobileStatusBadge group="payment" status={payment.status} /></span>}
            onClick={() => onOpen(payment.id)}
            chevron
          />
        )}
      />
    </>
  );
};

export const WalletInvoicesPanel: React.FC<WalletListPanelProps> = ({ refreshToken }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmWalletInvoices();
  useReloadOnToken(list.reload, refreshToken);

  return (
    <>
      <p className="cmm-muted">{t('wallet.invoicesLead')}</p>
      <MobilePagedList
        list={list}
        emptyTitle={t('wallet.noInvoices')}
        label={t('wallet.tabs.invoices')}
        renderRow={(invoice) => (
          <MobileListRow
            key={invoice.id}
            title={invoice.invoice_number}
            subtitle={format.date(invoice.issued_date ?? invoice.created_at)}
            trailing={<span className="cmmc-trail"><strong>{format.money(invoice.total, invoice.payment?.currency)}</strong><MobileStatusBadge group="invoice" status={invoice.status} /></span>}
          />
        )}
      />
    </>
  );
};

export const WalletRefundsPanel: React.FC<WalletListPanelProps> = ({ refreshToken }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmWalletRefunds();
  useReloadOnToken(list.reload, refreshToken);

  return (
    <>
      <p className="cmm-muted">{t('wallet.refundsLead')}</p>
      <MobilePagedList
        list={list}
        emptyTitle={t('wallet.noRefunds')}
        label={t('wallet.tabs.refunds')}
        renderRow={(refund) => (
          <MobileListRow
            key={refund.id}
            title={`${t('wallet.columnPayment')} #${refund.payment_id}`}
            subtitle={refund.reason ?? t('common.unavailable')}
            meta={[format.date(refund.requested_at ?? refund.created_at), refund.admin_notes].filter(Boolean).join(' · ')}
            trailing={<span className="cmmc-trail"><strong>{format.money(refund.amount, refund.payment?.currency)}</strong><MobileStatusBadge group="refund" status={refund.status} /></span>}
          />
        )}
      />
    </>
  );
};

export const WalletWithdrawalsPanel: React.FC<WalletListPanelProps> = ({ refreshToken }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmWalletWithdrawals();
  useReloadOnToken(list.reload, refreshToken);

  return (
    <>
      <p className="cmm-muted">{t('wallet.withdrawalsLead')}</p>
      <MobilePagedList
        list={list}
        emptyTitle={t('wallet.noWithdrawals')}
        label={t('wallet.withdrawalHistory')}
        renderRow={(withdrawal) => (
          <MobileListRow
            key={withdrawal.id}
            title={t(`wallet.methods.${withdrawal.method}`, { defaultValue: withdrawal.method })}
            subtitle={format.date(withdrawal.created_at)}
            meta={withdrawal.admin_notes}
            trailing={<span className="cmmc-trail"><strong>{format.money(withdrawal.amount, withdrawal.currency)}</strong><MobileStatusBadge group="withdrawal" status={withdrawal.status} /></span>}
          />
        )}
      />
    </>
  );
};
