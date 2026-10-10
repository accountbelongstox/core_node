import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmInvoice, CmListPage, CmPayment, CmRefund, CmWallet, CmWalletTransaction, CmWithdrawal } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmHumanize, cmTotalPages } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

const LEDGER_KEY_PREFIX = 'wallet.ledger.';
const OUTGOING_DIRECTION = 'out';
/** Freeze/unfreeze rows move money between available and frozen; the total balance does not change. */
const HOLD_DIRECTIONS: Record<string, string> = { freeze: 'frozen', unfreeze: 'released' };

/** Hold state (`frozen`/`released`) of a freeze or unfreeze ledger row, otherwise null. */
export const cmTransactionHold = (transaction: CmWalletTransaction): string | null => (
  HOLD_DIRECTIONS[String(transaction.metadata?.direction ?? '')] ?? null
);

export const cmTransactionOutgoing = (transaction: CmWalletTransaction): boolean => (
  transaction.metadata?.direction === OUTGOING_DIRECTION || Number(transaction.amount) < 0
);

export type CmTransactionSign = '+' | '−' | '';
export type CmTransactionTone = 'positive' | 'negative' | 'neutral';

/** Sign and tone an amount is shown with; holds are neutral and carry no sign. */
export function cmTransactionAmountStyle(transaction: CmWalletTransaction): { sign: CmTransactionSign; tone: CmTransactionTone; status: string } {
  const hold = cmTransactionHold(transaction);
  if (hold) return { sign: '', tone: 'neutral', status: hold };
  return cmTransactionOutgoing(transaction)
    ? { sign: '−', tone: 'negative', status: transaction.status }
    : { sign: '+', tone: 'positive', status: transaction.status };
}

/** Localized ledger text from `description_code` and params; legacy rows fall back to the server text. */
export function useCmLedgerDescription(): (transaction: CmWalletTransaction) => string | null {
  const { t } = useTranslation('cm');
  return useCallback((transaction) => {
    const code = transaction.description_code;
    if (!code) return transaction.description;
    return t(`${LEDGER_KEY_PREFIX}${code}`, { ...(transaction.description_params ?? {}), defaultValue: cmHumanize(code) });
  }, [t]);
}

const fetchTransactions = (page: number) => cmApi.getWalletTransactions(page);
const extractTransactions = (data: CmListPage<CmWalletTransaction>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

export function useCmWalletTransactions(): CmPagedList<CmWalletTransaction> {
  return useCmPagedList(fetchTransactions, extractTransactions, 'wallet.transactionsLoadFailed');
}

const extractPage = <T>(data: CmListPage<T>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

const fetchPayments = (page: number) => cmApi.getPayments(page);
const fetchInvoices = (page: number) => cmApi.getInvoices(page);
const fetchRefunds = (page: number) => cmApi.getRefunds(page);
const fetchWithdrawals = (page: number) => cmApi.getWithdrawals(page);
const extractPayments = extractPage<CmPayment>;
const extractInvoices = extractPage<CmInvoice>;
const extractRefunds = extractPage<CmRefund>;
const extractWithdrawals = extractPage<CmWithdrawal>;

export const useCmWalletPayments = (): CmPagedList<CmPayment> => useCmPagedList(fetchPayments, extractPayments, 'wallet.paymentsLoadFailed');
export const useCmWalletInvoices = (): CmPagedList<CmInvoice> => useCmPagedList(fetchInvoices, extractInvoices, 'wallet.invoicesLoadFailed');
export const useCmWalletRefunds = (): CmPagedList<CmRefund> => useCmPagedList(fetchRefunds, extractRefunds, 'wallet.refundsLoadFailed');
export const useCmWalletWithdrawals = (): CmPagedList<CmWithdrawal> => useCmPagedList(fetchWithdrawals, extractWithdrawals, 'wallet.withdrawalsLoadFailed');

export interface CmWalletBalance {
  key: 'available' | 'frozen' | 'balance';
  tone: 'green' | 'amber' | 'blue';
  value: string;
}

export interface CmWalletModel {
  wallet: CmWallet | null;
  loading: boolean;
  error: string | null;
  currency: string | null;
  balances: CmWalletBalance[];
  reload: () => Promise<void>;
}

/** Wallet balances; `reload` re-reads the wallet and the bootstrap counters. */
export function useCmWallet(): CmWalletModel {
  const { t } = useTranslation('cm');
  const { bootstrap, refresh } = useCmBootstrap();
  const [wallet, setWallet] = useState<CmWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    const response = await cmApi.getWallet();
    if (response.success && response.data) {
      setWallet(response.data);
      setError(null);
    } else {
      setError(cmErrorMessage(t, response, 'wallet.loadFailed'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    await load();
    await refresh();
  }, [load, refresh]);

  const balances: CmWalletBalance[] = wallet ? [
    { key: 'available', tone: 'green', value: wallet.available_balance },
    { key: 'frozen', tone: 'amber', value: wallet.frozen_balance },
    { key: 'balance', tone: 'blue', value: wallet.balance },
  ] : [];

  return {
    wallet,
    loading,
    error,
    currency: wallet?.currency ?? bootstrap?.vocabulary.policy.currency ?? null,
    balances,
    reload,
  };
}
