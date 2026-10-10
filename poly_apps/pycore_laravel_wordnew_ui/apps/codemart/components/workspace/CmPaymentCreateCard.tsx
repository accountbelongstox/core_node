import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmPaymentCreate } from '../../shared/useCmWalletActions';
import { CmNotice, useCmNotice } from './CmStateViews';

interface CmPaymentCreateCardProps {
  onCreated: () => Promise<void>;
}

/** Direct payment to another CodeMart user (`POST /payments`); wallet payments settle at once, other methods stay pending. */
export const CmPaymentCreateCard: React.FC<CmPaymentCreateCardProps> = ({ onCreated }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const form = useCmPaymentCreate(notice, onCreated);
  const [open, setOpen] = useState(false);

  if (!form.available) return null;

  return (
    <section className="cm-payment-create">
      <div className="cm-table-actions">
        <button type="button" className="cm-workspace-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Send aria-hidden="true" /> {t('wallet.paymentCreate.toggle')}
        </button>
      </div>
      {open && (
        <form className="cm-project-form cm-inline-form" onSubmit={(event) => { event.preventDefault(); void form.submit(); }} noValidate>
          <p className="cm-field-hint">{t('wallet.paymentCreate.lead')}</p>
          <label>
            <span>{t('wallet.paymentCreate.payee')}</span>
            <input inputMode="numeric" value={form.payeeId} onChange={(event) => form.setPayeeId(event.target.value)} aria-invalid={form.payeeId !== '' && !form.payeeValid} />
            {form.payeeId !== '' && !form.payeeValid && <small className="cm-field-error">{t('wallet.paymentCreate.payeeInvalid')}</small>}
          </label>
          <label>
            <span>{t('wallet.columnAmount')}</span>
            <input type="number" min={0.01} step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => form.setAmount(event.target.value)} aria-invalid={form.amount !== '' && !form.amountValid} />
            {form.amount !== '' && !form.amountValid && <small className="cm-field-error">{t('wallet.amountPositive')}</small>}
          </label>
          <label>
            <span>{t('wallet.columnType')}</span>
            <select value={form.selectedType} onChange={(event) => form.setType(event.target.value)}>
              {form.paymentCreatableTypes.map((value) => <option key={value} value={value}>{t(`wallet.paymentTypes.${value}`, { defaultValue: value })}</option>)}
            </select>
          </label>
          <label>
            <span>{t('wallet.columnMethod')}</span>
            <select value={form.selectedMethod} onChange={(event) => form.setMethod(event.target.value)}>
              {form.paymentMethods.map((value) => <option key={value} value={value}>{t(`wallet.methods.${value}`, { defaultValue: value })}</option>)}
            </select>
          </label>
          <label>
            <span>{t('wallet.paymentCreate.project')} <small className="cm-field-hint">{t('common.optional')}</small></span>
            <input inputMode="numeric" value={form.projectId} onChange={(event) => form.setProjectId(event.target.value)} aria-invalid={!form.projectValid} />
          </label>
          <label>
            <span>{t('wallet.paymentCreate.description')} <small className="cm-field-hint">{t('common.optional')}</small></span>
            <input value={form.description} maxLength={500} onChange={(event) => form.setDescription(event.target.value)} />
          </label>
          {form.gatewayHint && <p className="cm-field-hint">{t('wallet.paymentCreate.gatewayHint')}</p>}
          <div className="cm-project-form__actions">
            <button type="submit" className="is-primary" disabled={!form.canSubmit}>{form.busy ? t('common.saving') : t('wallet.paymentCreate.submit')}</button>
          </div>
        </form>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

export default CmPaymentCreateCard;
