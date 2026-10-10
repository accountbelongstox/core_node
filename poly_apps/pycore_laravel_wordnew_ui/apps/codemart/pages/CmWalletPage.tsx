import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark, Lock, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { CmDepositBankInfo, CmWallet } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPaymentCreateCard } from '../components/workspace/CmPaymentCreateCard';
import { CmPaymentDetailPanel } from '../components/workspace/CmPaymentDetailPanel';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { type CmPagedList } from '../components/workspace/useCmPagedList';
import {
  cmTransactionAmountStyle,
  useCmLedgerDescription,
  useCmWallet,
  useCmWalletInvoices,
  useCmWalletPayments,
  useCmWalletRefunds,
  useCmWalletTransactions,
  useCmWalletWithdrawals,
} from '../shared/useCmWallet';
import {
  CM_BANK_FIELDS,
  CM_BANK_TRANSFER,
  CM_DEPOSIT_PENDING,
  useCmDeposits,
  useCmPaymentActions,
  useCmWalletTopUp,
  useCmWithdrawalForm,
} from '../shared/useCmWalletActions';

const WALLET_TABS = ['transactions', 'deposits', 'payments', 'invoices', 'refunds', 'withdrawals'] as const;
const WITHDRAW_TAB = 'withdrawals';
const TAB_QUERY_KEY = 'cm_wallet_tab';

type CmWalletTab = typeof WALLET_TABS[number];

/** Loading, error, and empty handling shared by every wallet table. */
function CmListBody<T>({ list, emptyKey, children }: { list: CmPagedList<T>; emptyKey: string; children: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation('cm');
  if (list.loading) return <CmLoadingState compact />;
  if (list.error) return <CmErrorState compact message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />;
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
  const configured = Boolean(info.bank.bank_name && info.bank.account_number);
  return (
    <div className="cm-bank-info">
      <h3><Landmark aria-hidden="true" /> {t('wallet.bank.title')}</h3>
      <p className="cm-field-hint">{t('wallet.bank.instructions', { amount: format.money(info.amount, currency), reference: info.reference })}</p>
      {configured ? (
        <dl>
          {CM_BANK_FIELDS.map((field) => (
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
      ) : (
        <p className="cm-public-form__notice is-error" role="alert">{t('wallet.bank.notConfigured')}</p>
      )}
    </div>
  );
};

const BALANCE_ICONS = { available: WalletCards, frozen: Lock, balance: ShieldCheck } as const;
/** Bank-transfer top-up of the wallet; an administrator confirms the transfer and the amount is credited. */
const CmWalletTopUp: React.FC<{ currency: string; onCreated: () => Promise<void> }> = ({ currency, onCreated }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const topUp = useCmWalletTopUp(notice, onCreated);

  return (
    <div className="cm-wallet-top-up">
      <h3>{t('wallet.topUp.title')}</h3>
      <p className="cm-field-hint">{t('wallet.topUp.lead')}</p>
      <form className="cm-project-form cm-inline-form" onSubmit={(event) => { event.preventDefault(); void topUp.submit(); }} noValidate>
        <label>
          <span>{t('wallet.columnAmount')}</span>
          <input
            type="number"
            min={topUp.minAmount || undefined}
            max={topUp.maxAmount || undefined}
            step="0.01"
            inputMode="decimal"
            value={topUp.amount}
            onChange={(event) => topUp.setAmount(event.target.value)}
            aria-invalid={topUp.amountInvalid}
          />
          {topUp.amountInvalid && <small className="cm-field-error">{t('wallet.topUp.range', { min: format.money(topUp.minAmount, currency), max: format.money(topUp.maxAmount, currency) })}</small>}
        </label>
        {topUp.methods.length > 1 && (
          <label>
            <span>{t('wallet.columnMethod')}</span>
            <select value={topUp.selectedMethod} onChange={(event) => topUp.setMethod(event.target.value)}>
              {topUp.methods.map((value) => (
                <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>
              ))}
            </select>
          </label>
        )}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={!topUp.canSubmit}>
            {topUp.busy ? t('common.saving') : t('wallet.topUp.submit')}
          </button>
        </div>
      </form>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {topUp.bankInfo && <CmBankInstructions info={topUp.bankInfo} currency={currency} />}
    </div>
  );
};

const CmDepositsTab: React.FC<{ onChanged: () => Promise<void> }> = ({ onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const deposits = useCmDeposits(notice, onChanged);
  const { info, history, currency, payableRoles, selectedRole, depositMethods } = deposits;

  if (deposits.loading) return <CmLoadingState compact />;
  if (deposits.loadError || !info) return <CmErrorState compact message={deposits.loadError ?? t('wallet.depositLoadFailed')} onRetry={deposits.reload} />;

  const topUpCreated = async (): Promise<void> => {
    await deposits.refresh();
    await onChanged();
  };

  return (
    <>
      <CmWalletTopUp currency={currency} onCreated={topUpCreated} />
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
          <form className="cm-project-form cm-inline-form" onSubmit={(event) => { event.preventDefault(); void deposits.create(); }} noValidate>
            <label>
              <span>{t('wallet.columnRole')}</span>
              <select value={deposits.roleType} onChange={(event) => deposits.setRoleType(event.target.value)}>
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
                value={deposits.amount}
                onChange={(event) => deposits.setAmount(event.target.value)}
                placeholder={selectedRole ? t('wallet.depositAmountDefault', { amount: format.money(selectedRole.remaining_amount, currency) }) : ''}
                aria-invalid={deposits.amountInvalid}
              />
              {deposits.amountInvalid && <small className="cm-field-error">{t('wallet.amountPositive')}</small>}
            </label>
            <label>
              <span>{t('wallet.columnMethod')}</span>
              <select value={deposits.selectedMethod} onChange={(event) => deposits.setMethod(event.target.value)}>
                {depositMethods.map((value) => (
                  <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>
                ))}
              </select>
            </label>
            <div className="cm-project-form__actions">
              <button type="submit" className="is-primary" disabled={!deposits.canSubmit}>
                {deposits.busy ? t('common.saving') : t('wallet.depositCreate')}
              </button>
            </div>
          </form>
        </>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {deposits.bankInfo && <CmBankInstructions info={deposits.bankInfo} currency={currency} />}
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
                    {deposit.status === CM_DEPOSIT_PENDING && deposit.payment_method === CM_BANK_TRANSFER && (
                      <button type="button" className="cm-workspace-button is-small" onClick={() => void deposits.showBankInfo(deposit.id)}>
                        {t('wallet.bank.show')}
                      </button>
                    )}
                    {deposit.status === CM_DEPOSIT_PENDING && (
                      <button type="button" className="cm-workspace-button is-small" onClick={() => void deposits.checkStatus(deposit.id)}>
                        {t('wallet.depositStatus.check')}
                      </button>
                    )}
                    {deposit.status === CM_DEPOSIT_PENDING && deposit.payment_method !== CM_BANK_TRANSFER && depositMethods.includes(deposit.payment_method) && deposit.payment_url && (
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

const CmPaymentsTab: React.FC<{ userId: number | null; onChanged: () => Promise<void> }> = ({ userId, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const list = useCmWalletPayments();
  const actions = useCmPaymentActions(notice, list.reload);
  const { busy, refundableStates, refundPaymentId, refundReason, setRefundReason, openRefund, requestRefund, createInvoice } = actions;
  const [detailId, setDetailId] = useState<number | null>(null);

  const paymentCreated = async (): Promise<void> => {
    await list.reload();
    await onChanged();
  };

  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.paymentsLead')}</p>
      <CmPaymentCreateCard onCreated={paymentCreated} />
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
                      <button type="button" className="cm-workspace-button is-small" aria-pressed={detailId === payment.id} onClick={() => setDetailId(detailId === payment.id ? null : payment.id)}>
                        {t('wallet.paymentDetail.open')}
                      </button>
                      {isPayee && (
                        <button type="button" className="cm-workspace-button is-small" disabled={busy} onClick={() => void createInvoice(payment.id)}>
                          {t('wallet.createInvoice')}
                        </button>
                      )}
                      {isPayer && refundableStates.includes(payment.status) && (refundPaymentId === payment.id ? (
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
      {detailId !== null && <CmPaymentDetailPanel paymentId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
};

const CmInvoicesTab: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = useCmWalletInvoices();
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
  const list = useCmWalletRefunds();
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
  const notice = useCmNotice();
  const list = useCmWalletWithdrawals();
  const form = useCmWithdrawalForm(wallet, notice, async () => {
    await list.load(1);
    await onChanged();
  });
  const { selectedMethod, submitted, amountError, account, fields } = form;

  return (
    <>
      <p className="cm-section-card__lead">{t('wallet.withdrawalsLead')}</p>
      <form className="cm-project-form cm-inline-form" onSubmit={(event) => { event.preventDefault(); void form.submit(); }} noValidate>
        <label>
          <span>{t('wallet.columnAmount')}</span>
          <input type="number" min={form.minAmount} step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => form.setAmount(event.target.value)} aria-invalid={submitted && Boolean(amountError)} />
          {submitted && amountError ? <small className="cm-field-error">{amountError}</small> : wallet && <small className="cm-field-hint">{t('wallet.withdrawAvailable', { amount: format.money(wallet.available_balance, wallet.currency) })}</small>}
        </label>
        <label>
          <span>{t('wallet.columnMethod')}</span>
          <select value={selectedMethod} onChange={(event) => form.setMethod(event.target.value)}>
            {form.methods.map((value) => (
              <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>
            ))}
          </select>
        </label>
        {fields.map((field) => (
          <label key={field}>
            <span>{t(`wallet.account.${field}`)}</span>
            <input value={account[field] ?? ''} onChange={(event) => form.setAccountField(field, event.target.value)} aria-invalid={submitted && !(account[field] ?? '').trim()} />
            {submitted && !(account[field] ?? '').trim() && <small className="cm-field-error">{t('wallet.fieldRequired')}</small>}
          </label>
        ))}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={form.busy || !selectedMethod}>{form.busy ? t('common.saving') : t('wallet.requestWithdrawal')}</button>
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
  const list = useCmWalletTransactions();
  const describe = useCmLedgerDescription();
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
            {list.items.map((transaction) => {
              const description = describe(transaction);
              const { sign, tone, status } = cmTransactionAmountStyle(transaction);
              return (
                <tr key={transaction.id}>
                  <td>
                    {t(`wallet.transactionTypes.${transaction.type}`, { defaultValue: transaction.type })}
                    {description && <small className="cm-cell-note">{description}</small>}
                  </td>
                  <td className={`is-num is-${tone}`}>{sign}{format.money(Math.abs(Number(transaction.amount)), currency)}</td>
                  <td className="is-num">{transaction.balance_after !== null ? format.money(transaction.balance_after, currency) : t('common.unavailable')}</td>
                  <td><CmStatusBadge group="transaction" status={status} /></td>
                  <td>{format.dateTime(transaction.created_at) || t('common.unavailable')}</td>
                </tr>
              );
            })}
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
  const { bootstrap, hasCapability } = useCmBootstrap();
  const [searchParams] = useSearchParams();
  const canWithdraw = hasCapability('finance.withdraw');
  const { wallet, loading: walletLoading, error: walletError, currency: walletCurrency, balances: balanceValues, reload: onChanged } = useCmWallet();
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

  // Deep links (e.g. the fund panel's "top up" hint) open a tab directly via
  // ?tab=<name>; the tab is then persisted like a manual switch.
  useEffect(() => {
    const requested = searchParams.get('tab');
    if ((WALLET_TABS as readonly string[]).includes(requested ?? '') && requested !== tab) {
      setTab(requested as CmWalletTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const balances = balanceValues.map((item) => ({ ...item, Icon: BALANCE_ICONS[item.key] }));

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="wallet.eyebrow"
        titleKey="nav.wallet"
        purposeKey="wallet.description"
        actions={(
          <button type="button" className="cm-workspace-button" onClick={() => void onChanged()}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        )}
      />
      {walletLoading && !wallet ? (
        <CmLoadingState compact />
      ) : walletError && !wallet ? (
        <CmErrorState message={walletError} onRetry={() => void onChanged()} />
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
        {activeTab === 'transactions' && <CmTransactionsTab currency={walletCurrency} />}
        {activeTab === 'deposits' && <CmDepositsTab onChanged={onChanged} />}
        {activeTab === 'payments' && <CmPaymentsTab userId={bootstrap?.user.id ?? null} onChanged={onChanged} />}
        {activeTab === 'invoices' && <CmInvoicesTab />}
        {activeTab === 'refunds' && <CmRefundsTab />}
        {activeTab === 'withdrawals' && canWithdraw && <CmWithdrawalsTab wallet={wallet} onChanged={onChanged} />}
      </section>
    </main>
  );
};

export default CmWalletPage;
