import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmWalletTopUp } from '../../../../shared/useCmWalletActions';
import { MobileButton, MobileField, MobileSheet } from '../../../ui';
import { useInlineFeedback } from '../parts/useInlineFeedback';
import { WalletBankInstructions } from './WalletBankInstructions';

interface WalletTopUpSheetProps {
  open: boolean;
  currency: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

/** Bank-transfer top-up: amount and method, then the transfer instructions for the pending deposit. */
export const WalletTopUpSheet: React.FC<WalletTopUpSheetProps> = ({ open, currency, onClose, onCreated }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { feedback, notice, clear } = useInlineFeedback();
  const topUp = useCmWalletTopUp(feedback, onCreated);

  const close = (): void => {
    clear();
    topUp.clearBankInfo();
    onClose();
  };

  return (
    <MobileSheet
      open={open}
      onClose={close}
      title={topUp.bankInfo ? t('wallet.bank.title') : t('wallet.topUp.title')}
      footer={topUp.bankInfo
        ? <MobileButton variant="primary" block onClick={close}>{t('mobile.c.done')}</MobileButton>
        : <MobileButton variant="primary" block loading={topUp.busy} disabled={!topUp.canSubmit} onClick={() => void topUp.submit()}>{topUp.busy ? t('common.saving') : t('wallet.topUp.submit')}</MobileButton>}
    >
      {topUp.bankInfo ? <WalletBankInstructions untitled info={topUp.bankInfo} currency={currency} /> : (
        <div className="cmmc-form">
          <p className="cmm-muted">{t('wallet.topUp.lead')}</p>
          <MobileField
            label={t('wallet.columnAmount')}
            error={topUp.amountInvalid && t('wallet.topUp.range', { min: format.money(topUp.minAmount, currency), max: format.money(topUp.maxAmount, currency) })}
          >
            <input
              className="cmm-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={topUp.minAmount || undefined}
              max={topUp.maxAmount || undefined}
              value={topUp.amount}
              aria-invalid={topUp.amountInvalid}
              onChange={(event) => topUp.setAmount(event.target.value)}
            />
          </MobileField>
          {topUp.methods.length > 1 && (
            <MobileField label={t('wallet.columnMethod')}>
              <select className="cmm-input" value={topUp.selectedMethod} onChange={(event) => topUp.setMethod(event.target.value)}>
                {topUp.methods.map((value) => <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>)}
              </select>
            </MobileField>
          )}
          {notice}
        </div>
      )}
    </MobileSheet>
  );
};
