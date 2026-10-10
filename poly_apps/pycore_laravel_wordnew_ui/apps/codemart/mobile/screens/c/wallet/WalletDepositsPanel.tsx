import React, { useEffect, useState } from 'react';
import { ExternalLink, Landmark, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmDepositRecord } from '../../../../api/CmApiTypes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { CM_BANK_TRANSFER, CM_DEPOSIT_PENDING, useCmDeposits } from '../../../../shared/useCmWalletActions';
import {
  MobileButton,
  MobileErrorState,
  MobileField,
  MobileList,
  MobileListRow,
  MobileNotice,
  MobileSectionHeader,
  MobileSheet,
  MobileSkeletonList,
  MobileStatusBadge,
} from '../../../ui';
import { MobileKeyValues } from '../parts/MobileKeyValues';
import { useInlineFeedback } from '../parts/useInlineFeedback';
import { WalletBankInstructions } from './WalletBankInstructions';

interface WalletDepositsPanelProps {
  onChanged: () => Promise<void>;
  refreshToken: number;
}

/** Per-role deposit policy, deposit creation, and the deposit history with bank instructions and status checks. */
export const WalletDepositsPanel: React.FC<WalletDepositsPanelProps> = ({ onChanged, refreshToken }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { feedback, notice, clear } = useInlineFeedback();
  const deposits = useCmDeposits(feedback, onChanged);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<CmDepositRecord | null>(null);
  const { info, history, currency, payableRoles, selectedRole, depositMethods } = deposits;
  const refresh = deposits.refresh;

  useEffect(() => {
    if (refreshToken > 0) void refresh();
  }, [refreshToken, refresh]);

  if (deposits.loading) return <MobileSkeletonList rows={3} />;
  if (deposits.loadError || !info) return <MobileErrorState message={deposits.loadError ?? t('wallet.depositLoadFailed')} onRetry={deposits.reload} />;

  const closeCreate = (): void => {
    clear();
    deposits.clearBankInfo();
    setCreateOpen(false);
  };

  const closeDetail = (): void => {
    clear();
    deposits.clearBankInfo();
    setSelected(null);
  };

  const current = selected ? history.find((item) => item.id === selected.id) ?? selected : null;
  const bankTransferPending = current !== null && current.status === CM_DEPOSIT_PENDING && current.payment_method === CM_BANK_TRANSFER;

  return (
    <>
      <p className="cmm-muted">{t('wallet.depositLead')}</p>
      {info.roles.length === 0 ? (
        <MobileNotice>{t('wallet.noDepositRoles')}</MobileNotice>
      ) : (
        <MobileList label={t('wallet.tabs.deposits')}>
          {info.roles.map((role) => (
            <MobileListRow
              key={role.role_type}
              title={<>{t(`roles.${role.role_type}`, { defaultValue: role.role_type })} <MobileStatusBadge group="role" status={role.role_status} /></>}
              subtitle={`${t('wallet.columnRequired')} ${format.money(role.required_amount, currency)} · ${t('wallet.columnPaid')} ${format.money(role.paid_for_role, currency)}`}
              trailing={role.is_sufficient
                ? <span className="cmm-badge" data-tone="success">{t('wallet.depositSufficient')}</span>
                : <span className="cmmc-trail"><strong>{format.money(role.remaining_amount, currency)}</strong><small>{t('wallet.columnRemaining')}</small></span>}
            />
          ))}
        </MobileList>
      )}
      {Number(info.pending_amount) > 0 && <MobileNotice>{t('wallet.pendingAmount', { amount: format.money(info.pending_amount, currency) })}</MobileNotice>}
      {info.roles.length > 0 && payableRoles.length === 0 && <MobileNotice tone="success">{t('wallet.allDepositsPaid')}</MobileNotice>}
      {payableRoles.length > 0 && (
        <MobileButton variant="primary" block icon={<Plus aria-hidden="true" />} onClick={() => setCreateOpen(true)}>{t('wallet.depositCreateTitle')}</MobileButton>
      )}

      <MobileSectionHeader title={t('wallet.depositHistory')} />
      {history.length === 0 ? (
        <MobileNotice>{t('wallet.noDeposits')}</MobileNotice>
      ) : (
        <MobileList label={t('wallet.depositHistory')}>
          {history.map((deposit) => (
            <MobileListRow
              key={deposit.id}
              title={t(`roles.${deposit.role_type}`, { defaultValue: deposit.role_type })}
              subtitle={`${t(`wallet.methods.${deposit.payment_method}`, { defaultValue: deposit.payment_method })} · ${format.date(deposit.created_at) || t('common.unavailable')}`}
              meta={deposit.admin_notes}
              trailing={<span className="cmmc-trail"><strong>{format.money(deposit.amount, currency)}</strong><MobileStatusBadge group="deposit" status={deposit.status} /></span>}
              onClick={() => setSelected(deposit)}
              chevron
            />
          ))}
        </MobileList>
      )}

      <MobileSheet
        open={createOpen}
        onClose={closeCreate}
        title={deposits.bankInfo ? t('wallet.bank.title') : t('wallet.depositCreateTitle')}
        footer={deposits.bankInfo
          ? <MobileButton variant="primary" block onClick={closeCreate}>{t('mobile.c.done')}</MobileButton>
          : <MobileButton variant="primary" block loading={deposits.busy} disabled={!deposits.canSubmit} onClick={() => void deposits.create()}>{deposits.busy ? t('common.saving') : t('wallet.depositCreate')}</MobileButton>}
      >
        {deposits.bankInfo ? <WalletBankInstructions untitled info={deposits.bankInfo} currency={currency} /> : (
          <div className="cmmc-form">
            <MobileField label={t('wallet.columnRole')}>
              <select className="cmm-input" value={deposits.roleType} onChange={(event) => deposits.setRoleType(event.target.value)}>
                {payableRoles.map((role) => <option key={role.role_type} value={role.role_type}>{t(`roles.${role.role_type}`, { defaultValue: role.role_type })}</option>)}
              </select>
            </MobileField>
            <MobileField label={`${t('wallet.columnAmount')} (${t('common.optional')})`} error={deposits.amountInvalid && t('wallet.amountPositive')}>
              <input
                className="cmm-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0.01}
                value={deposits.amount}
                placeholder={selectedRole ? t('wallet.depositAmountDefault', { amount: format.money(selectedRole.remaining_amount, currency) }) : ''}
                aria-invalid={deposits.amountInvalid}
                onChange={(event) => deposits.setAmount(event.target.value)}
              />
            </MobileField>
            <MobileField label={t('wallet.columnMethod')}>
              <select className="cmm-input" value={deposits.selectedMethod} onChange={(event) => deposits.setMethod(event.target.value)}>
                {depositMethods.map((value) => <option key={value} value={value}>{t(`wallet.methods.${value}`)}</option>)}
              </select>
            </MobileField>
            {notice}
          </div>
        )}
      </MobileSheet>

      <MobileSheet open={current !== null} onClose={closeDetail} title={current ? t('mobile.c.depositDetailTitle', { id: current.id }) : ''}>
        {current && (
          <div className="cmmc-form">
            <MobileKeyValues
              items={[
                { label: t('wallet.columnRole'), value: t(`roles.${current.role_type}`, { defaultValue: current.role_type }) },
                { label: t('wallet.columnAmount'), value: format.money(current.amount, currency) },
                { label: t('wallet.columnMethod'), value: t(`wallet.methods.${current.payment_method}`, { defaultValue: current.payment_method }) },
                { label: t('wallet.columnStatus'), value: <MobileStatusBadge group="deposit" status={current.status} /> },
                { label: t('wallet.columnDate'), value: format.dateTime(current.created_at) || t('common.unavailable') },
                current.admin_notes ? { label: t('mobile.c.adminNotes'), value: current.admin_notes } : null,
              ]}
            />
            {deposits.bankInfo && <WalletBankInstructions info={deposits.bankInfo} currency={currency} />}
            {notice}
            {current.status === CM_DEPOSIT_PENDING && (
              <div className="cmmc-row-actions">
                {bankTransferPending && !deposits.bankInfo && (
                  <MobileButton icon={<Landmark aria-hidden="true" />} onClick={() => void deposits.showBankInfo(current.id)}>{t('wallet.bank.show')}</MobileButton>
                )}
                <MobileButton icon={<RefreshCw aria-hidden="true" />} onClick={() => void deposits.checkStatus(current.id)}>{t('wallet.depositStatus.check')}</MobileButton>
                {current.payment_method !== CM_BANK_TRANSFER && depositMethods.includes(current.payment_method) && current.payment_url && (
                  <a className="cmm-btn is-primary" href={current.payment_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /><span>{t('wallet.payNow')}</span></a>
                )}
              </div>
            )}
          </div>
        )}
      </MobileSheet>
    </>
  );
};
