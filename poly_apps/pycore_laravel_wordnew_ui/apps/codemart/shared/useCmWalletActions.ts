import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmDepositBankInfo, CmDepositInfo, CmDepositRecord, CmDepositRole, CmPaymentDetail, CmWallet } from '../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../api/cmErrors';
import { useCmIdempotencyKey } from '../api/useCmIdempotencyKey';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import type { CmFeedback } from './cmFeedback';

export const CM_BANK_TRANSFER = 'bank_transfer';
export const CM_DEPOSIT_PENDING = 'pending';
export const CM_BANK_FIELDS = ['bank_name', 'account_name', 'account_number', 'branch', 'swift_code', 'currency'] as const;
export const CM_WITHDRAWAL_ACCOUNT_FIELDS: Record<string, readonly string[]> = {
  bank_transfer: ['account_name', 'account_number', 'bank_name'],
  alipay: ['account_name', 'account'],
  wechat: ['account_name', 'account'],
};
const WALLET_TOP_UP_PURPOSE = 'wallet';
const WALLET_METHOD = 'wallet';
const HTTP_CREATED = 201;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

type CmAsyncAction = () => Promise<void>;

function parseDeposits(data: unknown): CmDepositRecord[] {
  if (Array.isArray(data)) return data as CmDepositRecord[];
  if (!data || typeof data !== 'object') return [];
  const source = data as { items?: unknown; deposits?: unknown };
  const list = Array.isArray(source.items) ? source.items : source.deposits;
  return Array.isArray(list) ? (list as CmDepositRecord[]) : [];
}

export interface CmWalletTopUpModel {
  methods: readonly string[];
  selectedMethod: string;
  setMethod: (method: string) => void;
  amount: string;
  setAmount: (amount: string) => void;
  minAmount: number;
  maxAmount: number;
  amountInvalid: boolean;
  canSubmit: boolean;
  busy: boolean;
  bankInfo: CmDepositBankInfo | null;
  submit: () => Promise<void>;
}

/** Bank-transfer top-up of the wallet; an administrator confirms the transfer and the amount is credited. */
export function useCmWalletTopUp(feedback: CmFeedback, onCreated: CmAsyncAction): CmWalletTopUpModel {
  const { t } = useTranslation('cm');
  const idempotency = useCmIdempotencyKey();
  const { policyList } = useCmBootstrap();
  const { walletTopUpMinAmount: minAmount, walletTopUpMaxAmount: maxAmount } = useCmPolicy();
  const methods = policyList('deposit_payment_methods');
  const [amount, setAmountState] = useState('');
  const [method, setMethodState] = useState('');
  const [bankInfo, setBankInfo] = useState<CmDepositBankInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedMethod = methods.includes(method) ? method : methods[0] ?? '';
  const value = Number(amount);
  const amountInvalid = amount !== '' && (!(value > 0) || (minAmount > 0 && value < minAmount) || (maxAmount > 0 && value > maxAmount));
  const canSubmit = !busy && amount !== '' && !amountInvalid && selectedMethod !== '';

  const setAmount = (next: string): void => {
    idempotency.reset();
    setAmountState(next);
  };
  const setMethod = (next: string): void => {
    idempotency.reset();
    setMethodState(next);
  };

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    feedback.clear();
    setBankInfo(null);
    const response = await cmApi.createDeposit({ role_type: WALLET_TOP_UP_PURPOSE, amount: value, payment_method: selectedMethod }, idempotency.current());
    setBusy(false);
    if (response.success && response.data) {
      idempotency.reset();
      setAmountState('');
      feedback.success(t('wallet.topUp.created'));
      const bank = await cmApi.getDepositBankInfo(response.data.deposit_id);
      if (bank.success && bank.data) setBankInfo(bank.data);
      await onCreated();
    } else {
      feedback.error(cmErrorMessage(t, response, 'wallet.topUp.failed'));
    }
  };

  return { methods, selectedMethod, setMethod, amount, setAmount, minAmount, maxAmount, amountInvalid, canSubmit, busy, bankInfo, submit };
}

export interface CmDepositsModel {
  info: CmDepositInfo | null;
  history: CmDepositRecord[];
  loading: boolean;
  loadError: string | null;
  reload: () => void;
  /** Re-read without the loading state, so open forms keep their place. */
  refresh: () => Promise<void>;
  currency: string;
  payableRoles: CmDepositRole[];
  selectedRole: CmDepositRole | null;
  roleType: string;
  setRoleType: (roleType: string) => void;
  amount: string;
  setAmount: (amount: string) => void;
  depositMethods: readonly string[];
  selectedMethod: string;
  setMethod: (method: string) => void;
  amountInvalid: boolean;
  canSubmit: boolean;
  busy: boolean;
  bankInfo: CmDepositBankInfo | null;
  showBankInfo: (depositId: number) => Promise<void>;
  create: () => Promise<void>;
  checkStatus: (depositId: number) => Promise<void>;
}

/** Per-role deposit policy, deposit history, deposit creation, bank instructions and status checks. */
export function useCmDeposits(feedback: CmFeedback, onChanged: CmAsyncAction): CmDepositsModel {
  const { t } = useTranslation('cm');
  const idempotency = useCmIdempotencyKey();
  const { policyList } = useCmBootstrap();
  const policyCurrency = useCmPolicy().currency;
  const depositMethods = policyList('deposit_payment_methods');
  const [info, setInfo] = useState<CmDepositInfo | null>(null);
  const [history, setHistory] = useState<CmDepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleType, setRoleTypeState] = useState('');
  const [amount, setAmountState] = useState('');
  const [method, setMethodState] = useState('');
  const [bankInfo, setBankInfo] = useState<CmDepositBankInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedMethod = depositMethods.includes(method) ? method : depositMethods[0] ?? '';

  const load = useCallback(async (): Promise<void> => {
    const [infoResponse, historyResponse] = await Promise.all([cmApi.getDepositInfo(), cmApi.getDepositHistory()]);
    if (infoResponse.success && infoResponse.data) {
      const data = infoResponse.data;
      setInfo(data);
      setLoadError(null);
      setRoleTypeState((current) => (data.roles.some((role) => role.role_type === current && !role.is_sufficient) ? current : data.roles.find((role) => !role.is_sufficient)?.role_type ?? ''));
    } else if (infoResponse.status === HTTP_NOT_FOUND && cmErrorCode(infoResponse) === 'role_not_found') {
      // Users with no CodeMart role (for example administrators) have no
      // deposit policy; show the top-up form with an empty role table.
      setInfo({
        currency: policyCurrency,
        roles: [],
        role_type: '',
        required_deposit: '0.00',
        current_deposit: '0.00',
        is_sufficient: true,
        shortfall: '0.00',
        pending_amount: '0.00',
      });
      setLoadError(null);
    } else {
      setLoadError(cmErrorMessage(t, infoResponse, 'wallet.depositLoadFailed'));
    }
    if (historyResponse.success) setHistory(parseDeposits(historyResponse.data));
    setLoading(false);
  }, [t, policyCurrency]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback((): void => {
    setLoading(true);
    void load();
  }, [load]);

  const payableRoles = (info?.roles ?? []).filter((role) => !role.is_sufficient);
  const selectedRole = payableRoles.find((role) => role.role_type === roleType) ?? null;
  const amountInvalid = amount !== '' && !(Number(amount) > 0);
  const canSubmit = !busy && roleType !== '' && selectedMethod !== '' && !amountInvalid;

  const changeInput = (apply: () => void): void => {
    idempotency.reset();
    apply();
  };

  const showBankInfo = async (depositId: number): Promise<void> => {
    const response = await cmApi.getDepositBankInfo(depositId);
    if (response.success && response.data) setBankInfo(response.data);
    else feedback.error(cmErrorMessage(t, response, 'wallet.bank.loadFailed'));
  };

  const create = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    feedback.clear();
    setBankInfo(null);
    const response = await cmApi.createDeposit({ role_type: roleType, amount: amount ? Number(amount) : undefined, payment_method: selectedMethod }, idempotency.current());
    setBusy(false);
    if (response.success && response.data) {
      idempotency.reset();
      setAmountState('');
      feedback.success(t('wallet.depositCreated'));
      if (response.data.payment_method === CM_BANK_TRANSFER) await showBankInfo(response.data.deposit_id);
      await load();
      await onChanged();
    } else {
      feedback.error(cmErrorMessage(t, response, 'wallet.depositFailed'));
    }
  };

  const checkStatus = async (depositId: number): Promise<void> => {
    feedback.clear();
    const response = await cmApi.getDepositStatus(depositId);
    if (!response.success || !response.data) {
      feedback.error(cmErrorMessage(t, response, 'wallet.depositStatus.failed'));
      return;
    }
    const fresh = response.data;
    setHistory((current) => current.map((item) => (item.id === depositId
      ? { ...item, status: fresh.status, admin_notes: fresh.admin_notes, paid_at: fresh.paid_at, payment_url: fresh.payment_url }
      : item)));
    const statusLabel = t(`states.deposit.${fresh.status}`, { defaultValue: t(`admin.states.deposit.${fresh.status}`, { defaultValue: fresh.status }) });
    (feedback.info ?? feedback.success)(t('wallet.depositStatus.result', { id: depositId, status: statusLabel }));
    if (fresh.status !== CM_DEPOSIT_PENDING) await onChanged();
  };

  return {
    info,
    history,
    loading,
    loadError,
    reload,
    refresh: load,
    currency: info?.currency ?? '',
    payableRoles,
    selectedRole,
    roleType,
    setRoleType: (next) => changeInput(() => setRoleTypeState(next)),
    amount,
    setAmount: (next) => changeInput(() => setAmountState(next)),
    depositMethods,
    selectedMethod,
    setMethod: (next) => changeInput(() => setMethodState(next)),
    amountInvalid,
    canSubmit,
    busy,
    bankInfo,
    showBankInfo,
    create,
    checkStatus,
  };
}

export interface CmPaymentActionsModel {
  busy: boolean;
  refundableStates: readonly string[];
  refundPaymentId: number | null;
  refundReason: string;
  setRefundReason: (reason: string) => void;
  openRefund: (paymentId: number | null) => void;
  requestRefund: (paymentId: number) => Promise<void>;
  createInvoice: (paymentId: number) => Promise<void>;
}

/** Refund request and invoice creation on the payments of the wallet; `reload` re-reads the payment list. */
export function useCmPaymentActions(feedback: CmFeedback, reload: CmAsyncAction): CmPaymentActionsModel {
  const { t } = useTranslation('cm');
  const idempotency = useCmIdempotencyKey();
  const { stateRule } = useCmBootstrap();
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
    feedback.clear();
    const response = await cmApi.requestRefund({ payment_id: paymentId, reason: refundReason.trim() }, idempotency.current());
    setBusy(false);
    if (response.success) {
      idempotency.reset();
      feedback.success(t('wallet.refundRequested'));
      setRefundPaymentId(null);
      setRefundReason('');
      await reload();
    } else {
      feedback.error(cmErrorMessage(t, response, 'wallet.refundFailed'));
    }
  };

  const createInvoice = async (paymentId: number): Promise<void> => {
    if (busy) return;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.createInvoice({ payment_id: paymentId });
    setBusy(false);
    if (response.success) feedback.success(t(response.status === HTTP_CREATED ? 'wallet.invoiceCreated' : 'wallet.invoiceExists'));
    else feedback.error(cmErrorMessage(t, response, 'wallet.invoiceFailed'));
  };

  return { busy, refundableStates: stateRule('payment_refundable'), refundPaymentId, refundReason, setRefundReason, openRefund, requestRefund, createInvoice };
}

export interface CmPaymentCreateModel {
  available: boolean;
  paymentMethods: readonly string[];
  paymentCreatableTypes: readonly string[];
  payeeId: string;
  amount: string;
  selectedType: string;
  selectedMethod: string;
  projectId: string;
  description: string;
  setPayeeId: (value: string) => void;
  setAmount: (value: string) => void;
  setType: (value: string) => void;
  setMethod: (value: string) => void;
  setProjectId: (value: string) => void;
  setDescription: (value: string) => void;
  payeeValid: boolean;
  amountValid: boolean;
  projectValid: boolean;
  gatewayHint: boolean;
  canSubmit: boolean;
  busy: boolean;
  submit: () => Promise<boolean>;
}

/** Direct payment to another CodeMart user (`POST /payments`); wallet payments settle at once, other methods stay pending. */
export function useCmPaymentCreate(feedback: CmFeedback, onCreated: CmAsyncAction): CmPaymentCreateModel {
  const { t } = useTranslation('cm');
  const idempotency = useCmIdempotencyKey();
  const { paymentMethods, paymentCreatableTypes } = useCmPolicy();
  const [payeeId, setPayeeIdState] = useState('');
  const [amount, setAmountState] = useState('');
  const [type, setTypeState] = useState('');
  const [method, setMethodState] = useState('');
  const [projectId, setProjectIdState] = useState('');
  const [description, setDescriptionState] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedType = paymentCreatableTypes.includes(type) ? type : paymentCreatableTypes[0] ?? '';
  const selectedMethod = paymentMethods.includes(method) ? method : paymentMethods[0] ?? '';
  const payeeValid = /^[1-9]\d*$/.test(payeeId.trim());
  const amountValid = Number(amount) > 0;
  const projectValid = projectId.trim() === '' || /^[1-9]\d*$/.test(projectId.trim());
  const canSubmit = !busy && payeeValid && amountValid && projectValid && selectedType !== '' && selectedMethod !== '';

  const edit = (apply: (value: string) => void) => (value: string): void => {
    idempotency.reset();
    apply(value);
  };

  const submit = async (): Promise<boolean> => {
    if (!canSubmit) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.createPayment({
      payee_id: Number(payeeId),
      amount: Number(amount),
      type: selectedType,
      payment_method: selectedMethod,
      project_id: projectId.trim() ? Number(projectId) : undefined,
      description: description.trim() || undefined,
    }, idempotency.current());
    setBusy(false);
    if (response.success && response.data) {
      idempotency.reset();
      const settled = selectedMethod === WALLET_METHOD;
      feedback.success(t(settled ? 'wallet.paymentCreate.sentWallet' : 'wallet.paymentCreate.sentPending', { id: response.data.id }));
      if (response.status !== HTTP_CREATED && response.data.idempotent_replay) (feedback.info ?? feedback.success)(t('wallet.paymentCreate.replayed', { id: response.data.id }));
      setAmountState('');
      setDescriptionState('');
      await onCreated();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'wallet.paymentCreate.failed'));
    return false;
  };

  return {
    available: paymentMethods.length > 0 && paymentCreatableTypes.length > 0,
    paymentMethods,
    paymentCreatableTypes,
    payeeId,
    amount,
    selectedType,
    selectedMethod,
    projectId,
    description,
    setPayeeId: edit(setPayeeIdState),
    setAmount: edit(setAmountState),
    setType: edit(setTypeState),
    setMethod: edit(setMethodState),
    setProjectId: edit(setProjectIdState),
    setDescription: edit(setDescriptionState),
    payeeValid,
    amountValid,
    projectValid,
    gatewayHint: selectedMethod !== WALLET_METHOD,
    canSubmit,
    busy,
    submit,
  };
}

export interface CmPaymentDetailModel {
  payment: CmPaymentDetail | null;
  loading: boolean;
  error: string | null;
  retryable: boolean;
  reload: () => Promise<void>;
}

/** Full record of one payment (`GET /payments/{id}`), visible to its payer and payee. */
export function useCmPaymentDetail(paymentId: number): CmPaymentDetailModel {
  const { t } = useTranslation('cm');
  const [payment, setPayment] = useState<CmPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getPayment(paymentId);
    if (response.success && response.data) {
      setPayment(response.data);
      setError(null);
    } else {
      setPayment(null);
      setError(cmErrorMessage(t, response, 'wallet.paymentDetail.loadFailed'));
      setRetryable(response.status !== HTTP_FORBIDDEN && response.status !== HTTP_NOT_FOUND);
    }
    setLoading(false);
  }, [paymentId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { payment, loading, error, retryable, reload };
}

export interface CmWithdrawalFormModel {
  methods: readonly string[];
  selectedMethod: string;
  setMethod: (method: string) => void;
  fields: readonly string[];
  amount: string;
  setAmount: (amount: string) => void;
  account: Record<string, string>;
  setAccountField: (field: string, value: string) => void;
  minAmount: number;
  amountError: string | null;
  missingField: boolean;
  submitted: boolean;
  busy: boolean;
  submit: () => Promise<void>;
}

/** Withdrawal request form: amount against the available balance, method, and the per-method account fields. */
export function useCmWithdrawalForm(wallet: CmWallet | null, feedback: CmFeedback, onCreated: CmAsyncAction): CmWithdrawalFormModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const { bootstrap, policyList } = useCmBootstrap();
  const methods = policyList('withdrawal_methods');
  const minAmount = Number(bootstrap?.vocabulary.policy.withdrawal_min_amount ?? 0);
  const [amount, setAmountState] = useState('');
  const [method, setMethodState] = useState('');
  const [account, setAccount] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const selectedMethod = methods.includes(method) ? method : methods[0] ?? '';
  const fields = CM_WITHDRAWAL_ACCOUNT_FIELDS[selectedMethod] ?? [];
  const available = Number(wallet?.available_balance ?? 0);
  const amountValue = Number(amount);
  const belowMinimum = !amount || !(amountValue > 0) || amountValue < minAmount;
  const amountError = belowMinimum
    ? (minAmount > 0 ? t('wallet.withdrawalMin', { amount: format.money(minAmount, wallet?.currency) }) : t('wallet.amountPositive'))
    : amountValue > available ? t('wallet.withdrawalTooHigh') : null;
  const missingField = fields.some((field) => !(account[field] ?? '').trim());

  const change = (apply: () => void): void => {
    idempotency.reset();
    apply();
  };

  const submit = async (): Promise<void> => {
    setSubmitted(true);
    if (busy || !selectedMethod || amountError || missingField) return;
    setBusy(true);
    feedback.clear();
    const accountInfo = Object.fromEntries(fields.map((field) => [field, (account[field] ?? '').trim()]));
    const response = await cmApi.requestWithdrawal({ amount: amountValue, method: selectedMethod, account_info: accountInfo }, idempotency.current());
    setBusy(false);
    if (response.success) {
      idempotency.reset();
      setAmountState('');
      setSubmitted(false);
      feedback.success(t('wallet.withdrawalRequested'));
      await onCreated();
    } else {
      feedback.error(cmErrorMessage(t, response, 'wallet.withdrawalFailed'));
    }
  };

  return {
    methods,
    selectedMethod,
    setMethod: (next) => change(() => setMethodState(next)),
    fields,
    amount,
    setAmount: (next) => change(() => setAmountState(next)),
    account,
    setAccountField: (field, value) => change(() => setAccount((current) => ({ ...current, [field]: value }))),
    minAmount,
    amountError,
    missingField,
    submitted,
    busy,
    submit,
  };
}
