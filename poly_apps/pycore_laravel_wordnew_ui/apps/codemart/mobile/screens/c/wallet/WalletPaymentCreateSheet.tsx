import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmPaymentCreate } from '../../../../shared/useCmWalletActions';
import { MobileButton, MobileField, MobileSheet } from '../../../ui';
import { useSheetFeedback } from '../parts/useSheetFeedback';

interface WalletPaymentCreateSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

/** Direct payment to another CodeMart user; wallet payments settle at once, other methods stay pending. */
export const WalletPaymentCreateSheet: React.FC<WalletPaymentCreateSheetProps> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice, clear } = useSheetFeedback();
  const form = useCmPaymentCreate(feedback, onCreated);

  const close = (): void => {
    clear();
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (await form.submit()) close();
  };

  return (
    <MobileSheet
      open={open}
      onClose={close}
      title={t('wallet.paymentCreate.toggle')}
      footer={<MobileButton variant="primary" block loading={form.busy} disabled={!form.canSubmit} onClick={() => void submit()}>{form.busy ? t('common.saving') : t('wallet.paymentCreate.submit')}</MobileButton>}
    >
      <div className="cmmc-form">
        <p className="cmm-muted">{t('wallet.paymentCreate.lead')}</p>
        <MobileField label={t('wallet.paymentCreate.payee')} error={form.payeeId !== '' && !form.payeeValid && t('wallet.paymentCreate.payeeInvalid')}>
          <input className="cmm-input" inputMode="numeric" value={form.payeeId} aria-invalid={form.payeeId !== '' && !form.payeeValid} onChange={(event) => form.setPayeeId(event.target.value)} />
        </MobileField>
        <MobileField label={t('wallet.columnAmount')} error={form.amount !== '' && !form.amountValid && t('wallet.amountPositive')}>
          <input className="cmm-input" type="number" inputMode="decimal" step="0.01" min={0.01} value={form.amount} aria-invalid={form.amount !== '' && !form.amountValid} onChange={(event) => form.setAmount(event.target.value)} />
        </MobileField>
        <div className="cmm-field-pair">
          <MobileField label={t('wallet.columnType')}>
            <select className="cmm-input" value={form.selectedType} onChange={(event) => form.setType(event.target.value)}>
              {form.paymentCreatableTypes.map((value) => <option key={value} value={value}>{t(`wallet.paymentTypes.${value}`, { defaultValue: value })}</option>)}
            </select>
          </MobileField>
          <MobileField label={t('wallet.columnMethod')}>
            <select className="cmm-input" value={form.selectedMethod} onChange={(event) => form.setMethod(event.target.value)}>
              {form.paymentMethods.map((value) => <option key={value} value={value}>{t(`wallet.methods.${value}`, { defaultValue: value })}</option>)}
            </select>
          </MobileField>
        </div>
        <MobileField label={`${t('wallet.paymentCreate.project')} (${t('common.optional')})`} error={!form.projectValid && t('wallet.paymentCreate.payeeInvalid')}>
          <input className="cmm-input" inputMode="numeric" value={form.projectId} aria-invalid={!form.projectValid} onChange={(event) => form.setProjectId(event.target.value)} />
        </MobileField>
        <MobileField label={`${t('wallet.paymentCreate.description')} (${t('common.optional')})`} hint={form.gatewayHint ? t('wallet.paymentCreate.gatewayHint') : undefined}>
          <input className="cmm-input" maxLength={500} value={form.description} onChange={(event) => form.setDescription(event.target.value)} />
        </MobileField>
        {notice}
      </div>
    </MobileSheet>
  );
};
