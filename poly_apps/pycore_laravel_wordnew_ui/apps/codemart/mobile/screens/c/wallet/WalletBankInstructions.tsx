import React from 'react';
import { Landmark } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmDepositBankInfo } from '../../../../api/CmApiTypes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { CM_BANK_FIELDS } from '../../../../shared/useCmWalletActions';
import { MobileNotice } from '../../../ui';
import { MobileCopyValue } from '../parts/MobileCopyValue';

const COPYABLE_FIELDS: readonly string[] = ['account_number', 'swift_code'];

/** Bank-transfer instructions of a pending deposit: account details and the payment reference to quote; `untitled` when a sheet title already says it. */
export const WalletBankInstructions: React.FC<{ info: CmDepositBankInfo; currency: string; untitled?: boolean }> = ({ info, currency, untitled = false }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const configured = Boolean(info.bank.bank_name && info.bank.account_number);

  return (
    <section className="cmmc-bank" aria-label={t('wallet.bank.title')}>
      {!untitled && <h3><Landmark aria-hidden="true" /> {t('wallet.bank.title')}</h3>}
      <p className="cmm-muted">{t('wallet.bank.instructions', { amount: format.money(info.amount, currency), reference: info.reference })}</p>
      {configured ? (
        <dl className="cmmc-kv">
          {CM_BANK_FIELDS.map((field) => (info.bank[field] ? (
            <div key={field}>
              <dt>{t(`wallet.bank.${field}`)}</dt>
              <dd>{COPYABLE_FIELDS.includes(field) ? <MobileCopyValue value={String(info.bank[field])} /> : info.bank[field]}</dd>
            </div>
          ) : null))}
          <div>
            <dt>{t('wallet.bank.reference')}</dt>
            <dd><MobileCopyValue value={info.reference} /></dd>
          </div>
        </dl>
      ) : (
        <MobileNotice tone="error">{t('wallet.bank.notConfigured')}</MobileNotice>
      )}
    </section>
  );
};
