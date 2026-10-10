import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import { cmErrorMessage } from '../../api/cmErrors';
import { useCmIdempotencyKey } from '../../api/useCmIdempotencyKey';
import { useCmPolicy } from '../../contexts/useCmPolicy';
import { CmNotice, useCmNotice } from './CmStateViews';

const WALLET_METHOD = 'wallet';
const HTTP_CREATED = 201;

interface CmPaymentCreateCardProps {
  onCreated: () => Promise<void>;
}

/** Direct payment to another CodeMart user (`POST /payments`); wallet payments settle at once, other methods stay pending. */
export const CmPaymentCreateCard: React.FC<CmPaymentCreateCardProps> = ({ onCreated }) => {
  const { t } = useTranslation('cm');
  const idempotency = useCmIdempotencyKey();
  const notice = useCmNotice();
  const { paymentMethods, paymentCreatableTypes } = useCmPolicy();
  const [open, setOpen] = useState(false);
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedType = paymentCreatableTypes.includes(type) ? type : paymentCreatableTypes[0] ?? '';
  const selectedMethod = paymentMethods.includes(method) ? method : paymentMethods[0] ?? '';
  const payeeValid = /^[1-9]\d*$/.test(payeeId.trim());
  const amountValid = Number(amount) > 0;
  const projectValid = projectId.trim() === '' || /^[1-9]\d*$/.test(projectId.trim());
  const canSubmit = !busy && payeeValid && amountValid && projectValid && selectedType !== '' && selectedMethod !== '';

  const edit = (apply: () => void): void => {
    idempotency.reset();
    apply();
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    notice.clear();
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
      notice.success(t(settled ? 'wallet.paymentCreate.sentWallet' : 'wallet.paymentCreate.sentPending', { id: response.data.id }));
      if (response.status !== HTTP_CREATED && response.data.idempotent_replay) notice.info(t('wallet.paymentCreate.replayed', { id: response.data.id }));
      setAmount('');
      setDescription('');
      await onCreated();
    } else {
      notice.error(cmErrorMessage(t, response, 'wallet.paymentCreate.failed'));
    }
  };

  if (paymentMethods.length === 0 || paymentCreatableTypes.length === 0) return null;

  return (
    <section className="cm-payment-create">
      <div className="cm-table-actions">
        <button type="button" className="cm-workspace-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Send aria-hidden="true" /> {t('wallet.paymentCreate.toggle')}
        </button>
      </div>
      {open && (
        <form className="cm-project-form cm-inline-form" onSubmit={(event) => void submit(event)} noValidate>
          <p className="cm-field-hint">{t('wallet.paymentCreate.lead')}</p>
          <label>
            <span>{t('wallet.paymentCreate.payee')}</span>
            <input inputMode="numeric" value={payeeId} onChange={(event) => edit(() => setPayeeId(event.target.value))} aria-invalid={payeeId !== '' && !payeeValid} />
            {payeeId !== '' && !payeeValid && <small className="cm-field-error">{t('wallet.paymentCreate.payeeInvalid')}</small>}
          </label>
          <label>
            <span>{t('wallet.columnAmount')}</span>
            <input type="number" min={0.01} step="0.01" inputMode="decimal" value={amount} onChange={(event) => edit(() => setAmount(event.target.value))} aria-invalid={amount !== '' && !amountValid} />
            {amount !== '' && !amountValid && <small className="cm-field-error">{t('wallet.amountPositive')}</small>}
          </label>
          <label>
            <span>{t('wallet.columnType')}</span>
            <select value={selectedType} onChange={(event) => edit(() => setType(event.target.value))}>
              {paymentCreatableTypes.map((value) => <option key={value} value={value}>{t(`wallet.paymentTypes.${value}`, { defaultValue: value })}</option>)}
            </select>
          </label>
          <label>
            <span>{t('wallet.columnMethod')}</span>
            <select value={selectedMethod} onChange={(event) => edit(() => setMethod(event.target.value))}>
              {paymentMethods.map((value) => <option key={value} value={value}>{t(`wallet.methods.${value}`, { defaultValue: value })}</option>)}
            </select>
          </label>
          <label>
            <span>{t('wallet.paymentCreate.project')} <small className="cm-field-hint">{t('common.optional')}</small></span>
            <input inputMode="numeric" value={projectId} onChange={(event) => edit(() => setProjectId(event.target.value))} aria-invalid={!projectValid} />
          </label>
          <label>
            <span>{t('wallet.paymentCreate.description')} <small className="cm-field-hint">{t('common.optional')}</small></span>
            <input value={description} maxLength={500} onChange={(event) => edit(() => setDescription(event.target.value))} />
          </label>
          {selectedMethod !== WALLET_METHOD && <p className="cm-field-hint">{t('wallet.paymentCreate.gatewayHint')}</p>}
          <div className="cm-project-form__actions">
            <button type="submit" className="is-primary" disabled={!canSubmit}>{busy ? t('common.saving') : t('wallet.paymentCreate.submit')}</button>
          </div>
        </form>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

export default CmPaymentCreateCard;
