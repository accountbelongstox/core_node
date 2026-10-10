import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmWallet } from '../../../../api/CmApiTypes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmWithdrawalForm } from '../../../../shared/useCmWalletActions';
import { MobileButton, MobileField, MobileSheet } from '../../../ui';
import { useSheetFeedback } from '../parts/useSheetFeedback';

interface WalletWithdrawalSheetProps {
  open: boolean;
  wallet: CmWallet | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

/** Withdrawal request: amount against the available balance, method and the account to pay out to. */
export const WalletWithdrawalSheet: React.FC<WalletWithdrawalSheetProps> = ({ open, wallet, onClose, onCreated }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { feedback, notice, clear } = useSheetFeedback();
  const form = useCmWithdrawalForm(wallet, feedback, async () => {
    await onCreated();
    clear();
    onClose();
  });
  const { submitted, amountError, account } = form;

  const close = (): void => {
    clear();
    onClose();
  };

  return (
    <MobileSheet
      open={open}
      onClose={close}
      title={t('wallet.requestWithdrawal')}
      footer={<MobileButton variant="primary" block loading={form.busy} disabled={!form.selectedMethod} onClick={() => void form.submit()}>{form.busy ? t('common.saving') : t('wallet.requestWithdrawal')}</MobileButton>}
    >
      <div className="cmmc-form">
        <p className="cmm-muted">{t('wallet.withdrawalsLead')}</p>
        <MobileField
          label={t('wallet.columnAmount')}
          error={submitted && amountError}
          hint={wallet ? t('wallet.withdrawAvailable', { amount: format.money(wallet.available_balance, wallet.currency) }) : undefined}
        >
          <input
            className="cmm-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={form.minAmount}
            value={form.amount}
            aria-invalid={submitted && Boolean(amountError)}
            onChange={(event) => form.setAmount(event.target.value)}
          />
        </MobileField>
        <MobileField label={t('wallet.columnMethod')}>
          <select className="cmm-input" value={form.selectedMethod} onChange={(event) => form.setMethod(event.target.value)}>
            {form.methods.map((value) => <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>)}
          </select>
        </MobileField>
        {form.fields.map((field) => (
          <MobileField key={field} label={t(`wallet.account.${field}`)} error={submitted && !(account[field] ?? '').trim() && t('wallet.fieldRequired')}>
            <input
              className="cmm-input"
              value={account[field] ?? ''}
              aria-invalid={submitted && !(account[field] ?? '').trim()}
              onChange={(event) => form.setAccountField(field, event.target.value)}
            />
          </MobileField>
        ))}
        {notice}
      </div>
    </MobileSheet>
  );
};
