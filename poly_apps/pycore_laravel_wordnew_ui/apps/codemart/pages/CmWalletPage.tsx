import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, Lock, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type {
  CmDepositBankInfo,
  CmDepositInfo,
  CmDepositRecord,
  CmInvoice,
  CmListPage,
  CmPayment,
  CmRefund,
  CmWallet,
  CmWalletTransaction,
  CmWithdrawal,
} from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmIdempotencyKey } from '../api/useCmIdempotencyKey';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';

const DEPOSIT_METHODS = ['alipay', 'wechat', 'bank_transfer'] as const;
const WITHDRAWAL_METHODS = ['bank_transfer', 'alipay', 'wechat'] as const;
const BANK_TRANSFER = 'bank_transfer';
const PENDING_STATUS = 'pending';
const REFUNDABLE_PAYMENT_STATUSES = new Set(['completed', 'disputed']);
const WALLET_TABS = ['transactions', 'deposits', 'payments', 'invoices', 'refunds', 'withdrawals'] as const;
const WITHDRAW_TAB = 'withdrawals';
const BANK_FIELDS = ['bank_name', 'account_name', 'account_number', 'branch', 'swift_code', 'currency'] as const;
const WITHDRAWAL_ACCOUNT_FIELDS: Record<string, readonly string[]> = {
  bank_transfer: ['account_name', 'account_number', 'bank_name'],
  alipay: ['account_name', 'account'],
  wechat: ['account_name', 'account'],
};
const MIN_WITHDRAWAL = 1;
const TAB_QUERY_KEY = 'cm_wallet_tab';

type CmWalletTab = typeof WALLET_TABS[number];

function parseDeposits(data: unknown): CmDepositRecord[] {
  if (Array.isArray(data)) return data as CmDepositRecord[];
  if (!data || typeof data !== 'object') return [];
  const source = data as { items?: unknown; deposits?: unknown };
  const list = Array.isArray(source.items) ? source.items : source.deposits;
  return Array.isArray(list) ? (list as CmDepositRecord[]) : [];
}

function extractPage<T>(data: CmListPage<T>) {
  return { items: Array.isArray(data.items) ? data.items : [], totalPages: cmTotalPages(data) };
}

const OUTGOING_DIRECTION = 'out';
const isOutgoing = (transaction: CmWalletTransaction): boolean => (
  transaction.metadata?.direction === OUTGOING_DIRECTION || Number(transaction.amount) < 0
);

const fetchPayments = (page: number) => cmApi.getPayments(page);
const fetchInvoices = (page: number) => cmApi.getInvoices(page);
const fetchRefunds = (page: number) => cmApi.getRefunds(page);
const fetchWithdrawals = (page: number) => cmApi.getWithdrawals(page);
const fetchTransactions = (page: number) => cmApi.getWalletTransactions(page);

/** Loading, error, and empty handling shared by every wallet table. */
function CmListBody<T>({ list, emptyKey, children }: { list: CmPagedList<T>; emptyKey: string; children: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation('cm');
  if (list.loading) return <CmLoadingState compact />;
  if (list.error) return <CmErrorState compact message={list.error} onRetry={() => void list.reload()} />;
  if (list.items.length === 0) return <CmEmptyState compact title={t(emptyKey)} />;
  return (
    <>
      <div className="cm-table-wrap">{children}</div>
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </>
  );
}

const CmBankInstructions: React.FC<{ info: CmDepositBankInfo; currency: string }> = ({ info, currency }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  return (
    <div className="cm-bank-info">
      <h3><Landmark aria-hidden="true" /> {t('wallet.bank.title')}</h3>
      <p className="cm-field-hint">{t('wallet.bank.instructions', { amount: format.money(info.amount, currency), reference: info.reference })}</p>
      <dl>
        {BANK_FIELDS.map((field) => (
          info.bank[field] ? (
            <React.Fragment key={field}>
              <dt>{t(`wallet.bank.${field}`)}</dt>
              <dd>{info.bank[field]}</dd>
            </React.Fragment>
          ) : null
        ))}
        <dt>{t('wallet.bank.reference')}</dt>
        <dd>{info.reference}</dd>
      </dl>
    </div>
  );
};

const CmDepositsTab: React.FC<{ onChanged: () => Promise<void> }> = ({ onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const notice = useCmNotice();
  const [info, setInfo] = useState<CmDepositInfo | null>(null);
  const [history, setHistory] = useState<CmDepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleType, setRoleType] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(DEPOSIT_METHODS[0]);
  const [bankInfo, setBankInfo] = useState<CmDepositBankInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const [infoResponse, historyResponse] = await Promise.all([cmApi.getDepositInfo(), cmApi.getDepositHistory()]);
    if (infoResponse.success && infoResponse.data) {
      const data = infoResponse.data;
      setInfo(data);
      setLoadError(null);
      setRoleType((current) => (data.roles.some((role) => role.role_type === current && !role.is_sufficient) ? current : data.roles.find((role) => !role.is_sufficient)?.role_type ?? ''));
    } else {
      setLoadError(cmErrorMessage(t, infoResponse, 'wallet.depositLoadFailed'));
    }
    if (historyResponse.success) setHistory(parseDeposits(historyResponse.data));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = info?.currency ?? '';
  const payableRoles = (info?.roles ?? []).filter((role) => !role.is_sufficient);
  const selectedRole = payableRoles.find((role) => role.role_type === roleType) ?? null;
  const amountInvalid = amount !== '' && !(Number(amount) > 0);

  const showBankInfo = async (depositId: number): Promise<void> => {
    const response = await cmApi.getDepositBankInfo(depositId);
    if (response.success && response.data) setBankInfo(response.data);
    else notice.error(cmErrorMessage(t, response, 'wallet.bank.loadFailed'));
  };

  const createDeposit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !roleType || amountInvalid) return;
    setBusy(true);
    notice.clear();
    setBankInfo(null);
    const response = await cmApi.createDeposit({ role_type: roleType, amount: amount ? Number(amount) : undefined, payment_method: method }, idempotency.current());
    setBusy(false);
    if (response.success && response.data) {
      idempotency.reset();
      setAmount('');
      notice.success(t('wallet.depositCreated'));
      if (response.data.payment_method === BANK_TRANSFER) await showBankInfo(response.data.deposit_id);
      await load();
      await onChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'wallet.depositFailed'));
    }
  };

  const changeInput = (apply: () => void): void => {
    idempotency.reset();
    apply();
  };

  if (loading) return <CmLoadingState compact />;
  if (loadError || !info) return <CmErrorState compact message={loadError ?? t('wallet.depositLoadFailed')} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.depositLead')}</p>
      {info.roles.length === 0 ? (
        <CmEmptyState compact title={t('wallet.noDepositRoles')} />
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>{t('wallet.columnRole')}</th>
                <th className="is-num">{t('wallet.columnRequired')}</th>
                <th className="is-num">{t('wallet.columnPaid')}</th>
                <th className="is-num">{t('wallet.columnRemaining')}</th>
                <th>{t('wallet.columnStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {info.roles.map((role) => (
                <tr key={role.role_type}>
                  <td>{t(`roles.${role.role_type}`, { defaultValue: role.role_type })} <CmStatusBadge group="role" status={role.role_status} /></td>
                  <td className="is-num">{format.money(role.required_amount, currency)}</td>
                  <td className="is-num">{format.money(role.paid_for_role, currency)}</td>
                  <td className="is-num">{format.money(role.remaining_amount, currency)}</td>
                  <td><span className="cm-status" data-status={role.is_sufficient ? 'completed' : 'pending'}>{role.is_sufficient ? t('wallet.depositSufficient') : t('wallet.depositShortfall')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {Number(info.pending_amount) > 0 && <CmNotice notice={{ tone: 'info', text: t('wallet.pendingAmount', { amount: format.money(info.pending_amount, currency) }) }} />}
      {info.roles.length > 0 && payableRoles.length === 0 && <CmNotice notice={{ tone: 'success', text: t('wallet.allDepositsPaid') }} />}
      {payableRoles.length > 0 && (
        <>
          <h3>{t('wallet.depositCreateTitle')}</h3>
          <form className="cm-project-form cm-inline-form" onSubmit={(event) => void createDeposit(event)} noValidate>
            <label>
              <span>{t('wallet.columnRole')}</span>
              <select value={roleType} onChange={(event) => changeInput(() => setRoleType(event.target.value))}>
                {payableRoles.map((role) => (
                  <option key={role.role_type} value={role.role_type}>{t(`roles.${role.role_type}`, { defaultValue: role.role_type })}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('wallet.columnAmount')} <small className="cm-field-hint">{t('common.optional')}</small></span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => changeInput(() => setAmount(event.target.value))}
                placeholder={selectedRole ? t('wallet.depositAmountDefault', { amount: format.money(selectedRole.remaining_amount, currency) }) : ''}
                aria-invalid={amountInvalid}
              />
              {amountInvalid && <small className="cm-field-error">{t('wallet.amountPositive')}</small>}
            </label>
            <label>
              <span>{t('wallet.columnMethod')}</span>
              <select value={method} onChange={(event) => changeInput(() => setMethod(event.target.value))}>
                {DEPOSIT_METHODS.map((value) => (
                  <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>
                ))}
              </select>
            </label>
            <div className="cm-project-form__actions">
              <button type="submit" className="is-primary" disabled={busy || !roleType || amountInvalid}>
                {busy ? t('common.saving') : t('wallet.depositCreate')}
              </button>
            </div>
          </form>
        </>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {bankInfo && <CmBankInstructions info={bankInfo} currency={currency} />}
      <h3>{t('wallet.depositHistory')}</h3>
      {history.length === 0 ? (
        <CmEmptyState compact title={t('wallet.noDeposits')} />
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>{t('wallet.columnRole')}</th>
                <th className="is-num">{t('wallet.columnAmount')}</th>
                <th>{t('wallet.columnMethod')}</th>
                <th>{t('wallet.columnStatus')}</th>
                <th>{t('wallet.columnDate')}</th>
                <th><span className="cm-visually-hidden">{t('wallet.columnActions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {history.map((deposit) => (
                <tr key={deposit.id}>
                  <td>{t(`roles.${deposit.role_type}`, { defaultValue: deposit.role_type })}</td>
                  <td className="is-num">{format.money(deposit.amount, currency)}</td>
                  <td>{t(`wallet.methods.${deposit.payment_method}`, { defaultValue: deposit.payment_method })}</td>
                  <td>
                    <CmStatusBadge group="deposit" status={deposit.status} />
                    {deposit.admin_notes && <small className="cm-cell-note">{deposit.admin_notes}</small>}
                  </td>
                  <td>{format.date(deposit.created_at) || t('common.unavailable')}</td>
                  <td>
                    {deposit.status === PENDING_STATUS && deposit.payment_method === BANK_TRANSFER && (
                      <button type="button" className="cm-workspace-button is-small" onClick={() => void showBankInfo(deposit.id)}>
                        {t('wallet.bank.show')}
                      </button>
                    )}
                    {deposit.status === PENDING_STATUS && deposit.payment_method !== BANK_TRANSFER && deposit.payment_url && (
                      <a className="cm-workspace-button is-small is-primary" href={deposit.payment_url} target="_blank" rel="noreferrer">{t('wallet.payNow')}</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const CmPaymentsTab: React.FC<{ userId: number | null }> = ({ userId }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const notice = useCmNotice();
  const list = useCmPagedList(fetchPayments, extractPage<CmPayment>, 'wallet.paymentsLoadFailed');
  const [refundPaymentId, setRefundPaymentId] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);

  const openRefund = (paymentId: number | null): void => {
    idempotency.reset();
    setRefundReason('');
    setRefundPaymentId(paymentId);
  };

  const requestRefund = async (paymentId: number): Promise<void> => {
    if (!refundReason.trim() || busy) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.requestRefund({ payment_id: paymentId, reason: refundReason.trim() }, idempotency.current());
    setBusy(false);
    if (response.success) {
      idempotency.reset();
      notice.success(t('wallet.refundRequested'));
      setRefundPaymentId(null);
      setRefundReason('');
      await list.reload();
    } else {
      notice.error(cmErrorMessage(t, response, 'wallet.refundFailed'));
    }
  };

  const createInvoice = async (paymentId: number): Promise<void> => {
    if (busy) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.createInvoice({ payment_id: paymentId });
    setBusy(false);
    if (response.success) notice.success(t('wallet.invoiceCreated'));
    else notice.error(cmErrorMessage(t, response, 'wallet.invoiceFailed'));
  };

  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.paymentsLead')}</p>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      <CmListBody list={list} emptyKey="wallet.noPayments">
        <table className="cm-table">
          <thead>
            <tr>
              <th>{t('wallet.columnDirection')}</th>
              <th>{t('wallet.columnType')}</th>
              <th className="is-num">{t('wallet.columnAmount')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
              <th><span className="cm-visually-hidden">{t('wallet.columnActions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((payment) => {
              const isPayer = userId !== null && payment.payer_id === userId;
              const isPayee = userId !== null && payment.payee_id === userId;
              return (
                <tr key={payment.id}>
                  <td>{isPayer ? t('wallet.outgoing') : t('wallet.incoming')}</td>
                  <td>{payment.type ? t(`wallet.paymentTypes.${payment.type}`, { defaultValue: payment.type }) : t('common.unavailable')}</td>
                  <td className="is-num">{format.money(payment.amount, payment.currency)}</td>
                  <td><CmStatusBadge group="payment" status={payment.status} /></td>
                  <td>{format.date(payment.created_at) || t('common.unavailable')}</td>
                  <td>
                    <div className="cm-table-actions">
                      {isPayee && (
                        <button type="button" className="cm-workspace-button is-small" disabled={busy} onClick={() => void createInvoice(payment.id)}>
                          {t('wallet.createInvoice')}
                        </button>
                      )}
                      {isPayer && REFUNDABLE_PAYMENT_STATUSES.has(payment.status) && (refundPaymentId === payment.id ? (
                        <span className="cm-table-actions__refund">
                          <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder={t('wallet.refundReasonPlaceholder')} aria-label={t('wallet.columnReason')} />
                          <button type="button" className="cm-workspace-button is-small is-primary" disabled={busy || !refundReason.trim()} onClick={() => void requestRefund(payment.id)}>
                            {t('wallet.refundSend')}
                          </button>
                          <button type="button" className="cm-workspace-button is-small" onClick={() => openRefund(null)}>{t('common.cancel')}</button>
                        </span>
                      ) : (
                        <button type="button" className="cm-workspace-button is-small" onClick={() => openRefund(payment.id)}>{t('wallet.requestRefund')}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CmListBody>
    </>
  );
};

const CmInvoicesTab: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmPagedList(fetchInvoices, extractPage<CmInvoice>, 'wallet.invoicesLoadFailed');
  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.invoicesLead')}</p>
      <CmListBody list={list} emptyKey="wallet.noInvoices">
        <table className="cm-table">
          <thead>
            <tr>
              <th>{t('wallet.columnInvoice')}</th>
              <th className="is-num">{t('wallet.columnAmount')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number}</td>
                <td className="is-num">{format.money(invoice.total, invoice.payment?.currency)}</td>
                <td><CmStatusBadge group="invoice" status={invoice.status} /></td>
                <td>{format.date(invoice.issued_date ?? invoice.created_at) || t('common.unavailable')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CmListBody>
    </>
  );
};

const CmRefundsTab: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmPagedList(fetchRefunds, extractPage<CmRefund>, 'wallet.refundsLoadFailed');
  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.refundsLead')}</p>
      <CmListBody list={list} emptyKey="wallet.noRefunds">
        <table className="cm-table">
          <thead>
            <tr>
              <th>{t('wallet.columnPayment')}</th>
              <th className="is-num">{t('wallet.columnAmount')}</th>
              <th>{t('wallet.columnReason')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((refund) => (
              <tr key={refund.id}>
                <td>#{refund.payment_id}</td>
                <td className="is-num">{format.money(refund.amount, refund.payment?.currency)}</td>
                <td className="cm-table__wrap">{refund.reason ?? t('common.unavailable')}</td>
                <td>
                  <CmStatusBadge group="refund" status={refund.status} />
                  {refund.admin_notes && <small className="cm-cell-note">{refund.admin_notes}</small>}
                </td>
                <td>{format.date(refund.requested_at ?? refund.created_at) || t('common.unavailable')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CmListBody>
    </>
  );
};

const CmWithdrawalsTab: React.FC<{ wallet: CmWallet | null; onChanged: () => Promise<void> }> = ({ wallet, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const notice = useCmNotice();
  const list = useCmPagedList(fetchWithdrawals, extractPage<CmWithdrawal>, 'wallet.withdrawalsLoadFailed');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(WITHDRAWAL_METHODS[0]);
  const [account, setAccount] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fields = WITHDRAWAL_ACCOUNT_FIELDS[method] ?? [];
  const available = Number(wallet?.available_balance ?? 0);
  const amountError = !amount || Number(amount) < MIN_WITHDRAWAL
    ? t('wallet.withdrawalMin', { amount: format.money(MIN_WITHDRAWAL, wallet?.currency) })
    : Number(amount) > available ? t('wallet.withdrawalTooHigh') : null;
  const missingField = fields.some((field) => !(account[field] ?? '').trim());

  const change = (apply: () => void): void => {
    idempotency.reset();
    apply();
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (busy || amountError || missingField) return;
    setBusy(true);
    notice.clear();
    const accountInfo = Object.fromEntries(fields.map((field) => [field, (account[field] ?? '').trim()]));
    const response = await cmApi.requestWithdrawal({ amount: Number(amount), method, account_info: accountInfo }, idempotency.current());
    setBusy(false);
    if (response.success) {
      idempotency.reset();
      setAmount('');
      setSubmitted(false);
      notice.success(t('wallet.withdrawalRequested'));
      await list.load(1);
      await onChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'wallet.withdrawalFailed'));
    }
  };

  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.withdrawalsLead')}</p>
      <form className="cm-project-form cm-inline-form" onSubmit={(event) => void submit(event)} noValidate>
        <label>
          <span>{t('wallet.columnAmount')}</span>
          <input type="number" min={MIN_WITHDRAWAL} step="0.01" inputMode="decimal" value={amount} onChange={(event) => change(() => setAmount(event.target.value))} aria-invalid={submitted && Boolean(amountError)} />
          {submitted && amountError ? <small className="cm-field-error">{amountError}</small> : wallet && <small className="cm-field-hint">{t('wallet.withdrawAvailable', { amount: format.money(wallet.available_balance, wallet.currency) })}</small>}
        </label>
        <label>
          <span>{t('wallet.columnMethod')}</span>
          <select value={method} onChange={(event) => change(() => setMethod(event.target.value))}>
            {WITHDRAWAL_METHODS.map((value) => (
              <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>
            ))}
          </select>
        </label>
        {fields.map((field) => (
          <label key={field}>
            <span>{t(`wallet.account.${field}`)}</span>
            <input value={account[field] ?? ''} onChange={(event) => change(() => setAccount((current) => ({ ...current, [field]: event.target.value })))} aria-invalid={submitted && !(account[field] ?? '').trim()} />
            {submitted && !(account[field] ?? '').trim() && <small className="cm-field-error">{t('wallet.fieldRequired')}</small>}
          </label>
        ))}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={busy}>{busy ? t('common.saving') : t('wallet.requestWithdrawal')}</button>
        </div>
      </form>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      <h3>{t('wallet.withdrawalHistory')}</h3>
      <CmListBody list={list} emptyKey="wallet.noWithdrawals">
        <table className="cm-table">
          <thead>
            <tr>
              <th className="is-num">{t('wallet.columnAmount')}</th>
              <th>{t('wallet.columnMethod')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td className="is-num">{format.money(withdrawal.amount, withdrawal.currency)}</td>
                <td>{t(`wallet.methods.${withdrawal.method}`, { defaultValue: withdrawal.method })}</td>
                <td>
                  <CmStatusBadge group="withdrawal" status={withdrawal.status} />
                  {withdrawal.admin_notes && <small className="cm-cell-note">{withdrawal.admin_notes}</small>}
                </td>
                <td>{format.date(withdrawal.created_at) || t('common.unavailable')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CmListBody>
    </>
  );
};

const CmTransactionsTab: React.FC<{ currency: string | null }> = ({ currency }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmPagedList(fetchTransactions, extractPage<CmWalletTransaction>, 'wallet.transactionsLoadFailed');
  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.transactionsLead')}</p>
      <CmListBody list={list} emptyKey="wallet.noTransactions">
        <table className="cm-table">
          <thead>
            <tr>
              <th>{t('wallet.columnType')}</th>
              <th className="is-num">{t('wallet.columnAmount')}</th>
              <th className="is-num">{t('wallet.columnBalanceAfter')}</th>
              <th>{t('wallet.columnStatus')}</th>
              <th>{t('wallet.columnDate')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  {t(`wallet.transactionTypes.${transaction.type}`, { defaultValue: transaction.type })}
                  {transaction.description && <small className="cm-cell-note">{transaction.description}</small>}
                </td>
                <td className={`is-num ${isOutgoing(transaction) ? 'is-negative' : 'is-positive'}`}>{isOutgoing(transaction) ? '−' : '+'}{format.money(Math.abs(Number(transaction.amount)), currency)}</td>
                <td className="is-num">{transaction.balance_after !== null ? format.money(transaction.balance_after, currency) : t('common.unavailable')}</td>
                <td><CmStatusBadge group="transaction" status={transaction.status} /></td>
                <td>{format.dateTime(transaction.created_at) || t('common.unavailable')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CmListBody>
    </>
  );
};

function readStoredTab(): CmWalletTab {
  try {
    const value = window.sessionStorage.getItem(TAB_QUERY_KEY);
    return (WALLET_TABS as readonly string[]).includes(value ?? '') ? (value as CmWalletTab) : 'transactions';
  } catch {
    return 'transactions';
  }
}

export const CmWalletPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, hasCapability, refresh } = useCmBootstrap();
  const canWithdraw = hasCapability('finance.withdraw');
  const [wallet, setWallet] = useState<CmWallet | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [tab, setTabState] = useState<CmWalletTab>(readStoredTab);
  const tabs = WALLET_TABS.filter((item) => item !== WITHDRAW_TAB || canWithdraw);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  const setTab = (next: CmWalletTab): void => {
    setTabState(next);
    try {
      window.sessionStorage.setItem(TAB_QUERY_KEY, next);
    } catch {
      /* storage unavailable: keep the in-memory tab */
    }
  };

  const loadWallet = useCallback(async (): Promise<void> => {
    const response = await cmApi.getWallet();
    if (response.success && response.data) {
      setWallet(response.data);
      setWalletError(null);
    } else {
      setWalletError(cmErrorMessage(t, response, 'wallet.loadFailed'));
    }
    setWalletLoading(false);
  }, [t]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const onChanged = useCallback(async (): Promise<void> => {
    await loadWallet();
    await refresh();
  }, [loadWallet, refresh]);

  const balances = wallet ? [
    { key: 'available', Icon: WalletCards, tone: 'green', value: wallet.available_balance },
    { key: 'frozen', Icon: Lock, tone: 'amber', value: wallet.frozen_balance },
    { key: 'balance', Icon: ShieldCheck, tone: 'blue', value: wallet.balance },
  ] : [];

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="wallet.eyebrow"
        titleKey="nav.wallet"
        purposeKey="wallet.description"
        actions={(
          <button type="button" className="cm-workspace-button" onClick={() => { setWalletLoading(true); void onChanged(); }}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        )}
      />
      {walletLoading && !wallet ? (
        <CmLoadingState compact />
      ) : walletError && !wallet ? (
        <CmErrorState message={walletError} onRetry={() => { setWalletLoading(true); void loadWallet(); }} />
      ) : (
        <section className="cm-metric-grid" aria-label={t('wallet.balancesLabel')}>
          {balances.map((item) => {
            const Icon = item.Icon;
            return (
              <article key={item.key} className="cm-metric-card" data-tone={item.tone}>
                <span><Icon aria-hidden="true" /></span>
                <div>
                  <strong>{format.money(item.value, wallet?.currency)}</strong>
                  <small>{t(`wallet.${item.key}`)}</small>
                  <small className="cm-metric-card__hint">{t(`wallet.${item.key}Hint`)}</small>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <nav className="cm-tabs" role="tablist" aria-label={t('nav.wallet')}>
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={activeTab === item} className={activeTab === item ? 'is-active' : ''} onClick={() => setTab(item)}>
            {t(`wallet.tabs.${item}`)}
          </button>
        ))}
      </nav>
      <section className="cm-section-card cm-wallet-panel" role="tabpanel">
        {activeTab === 'transactions' && <CmTransactionsTab currency={wallet?.currency ?? bootstrap?.vocabulary.policy.currency ?? null} />}
        {activeTab === 'deposits' && <CmDepositsTab onChanged={onChanged} />}
        {activeTab === 'payments' && <CmPaymentsTab userId={bootstrap?.user.id ?? null} />}
        {activeTab === 'invoices' && <CmInvoicesTab />}
        {activeTab === 'refunds' && <CmRefundsTab />}
        {activeTab === 'withdrawals' && canWithdraw && <CmWithdrawalsTab wallet={wallet} onChanged={onChanged} />}
      </section>
    </main>
  );
};

export default CmWalletPage;
