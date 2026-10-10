import React, { useMemo, useState } from 'react';
import { Banknote, Check, RotateCcw, X } from 'lucide-react';
import { cmAdminApi } from '../../../../admin/CmAdminApi';
import { useCmAdminList, useCmAdminParam } from '../../../../admin/useCmAdminData';
import { useCmBootstrap } from '../../../../contexts/CmBootstrapContext';
import { MobileButton, MobileScreen, MobileStatusBadge } from '../../../ui';
import { MobilePills } from '../parts/MobilePills';
import { AdminRecord, AdminRecordList, AdminSearch, AdminStatusFilter, AdminUserLink, useAdminText, useMobileAdminActions } from './MobileAdminParts';

export const MobileAdminDepositsScreen: React.FC = () => {
  const { t, money, dateTime } = useAdminText();
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status', 'pending'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.deposits(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <MobileScreen title={t('admin.nav.deposits')} onRefresh={list.reload}>
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('deposit')} optionLabel={(option) => t(`admin.states.deposit.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noDeposits"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={`${t('admin.recordNumber', { id: item.id })} · ${money(item.amount)}`}
            badge={<MobileStatusBadge status={item.status} prefix="admin.states.deposit" />}
            facts={[
              { label: t('admin.columnUser'), value: <AdminUserLink user={item.user} userId={item.user_id} /> },
              { label: t('admin.columnRole'), value: t(`roles.${item.role_type}`, { defaultValue: item.role_type }) },
              { label: t('admin.columnMethod'), value: t(`admin.method.${item.payment_method}`, { defaultValue: item.payment_method }) },
              { label: t('admin.columnCreated'), value: dateTime(item.created_at) },
            ]}
            note={item.admin_notes}
            actions={item.status === 'pending' ? (
              <>
                <MobileButton variant="primary" icon={<Check aria-hidden="true" />} onClick={() => actions.confirmDeposit(item)}>{t('admin.confirmDeposit')}</MobileButton>
                <MobileButton variant="danger" icon={<X aria-hidden="true" />} onClick={() => actions.rejectDeposit(item)}>{t('admin.reject')}</MobileButton>
              </>
            ) : item.status === 'paid' ? (
              <MobileButton variant="danger" icon={<RotateCcw aria-hidden="true" />} onClick={() => actions.refundDeposit(item)}>{t('admin.deposits.refund')}</MobileButton>
            ) : undefined}
          />
        )}
      />
      {actions.sheet}
    </MobileScreen>
  );
};

export const MobileAdminRefundsScreen: React.FC = () => {
  const { t, money, dateTime } = useAdminText();
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status', 'pending'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.refunds(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <MobileScreen title={t('admin.nav.refunds')} onRefresh={list.reload}>
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('refund')} optionLabel={(option) => t(`admin.states.refund.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noRefunds"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={`${t('admin.recordNumber', { id: item.id })} · ${money(item.amount, item.currency)}`}
            badge={<MobileStatusBadge status={item.status} prefix="admin.states.refund" />}
            facts={[
              { label: t('admin.columnPayment'), value: t('admin.paymentNumber', { id: item.payment_id }) },
              { label: t('admin.refunds.parties'), value: <><AdminUserLink user={item.payer} /> → <AdminUserLink user={item.payee} /></> },
              item.requester && item.requester.id !== item.payer?.id ? { label: t('admin.refunds.requestedBy'), value: <AdminUserLink user={item.requester} /> } : null,
              { label: t('admin.columnReason'), value: item.reason ?? t('common.unavailable') },
              { label: t('admin.refunds.requestedAt'), value: dateTime(item.requested_at) },
            ]}
            note={[item.notes, item.admin_notes].filter(Boolean).join(' · ') || undefined}
            actions={item.status === 'pending' ? (
              <>
                <MobileButton variant="primary" icon={<Check aria-hidden="true" />} onClick={() => actions.approveRefund(item)}>{t('admin.approve')}</MobileButton>
                <MobileButton variant="danger" icon={<X aria-hidden="true" />} onClick={() => actions.rejectRefund(item)}>{t('admin.reject')}</MobileButton>
              </>
            ) : item.status === 'approved' ? (
              <>
                <MobileButton variant="primary" icon={<RotateCcw aria-hidden="true" />} onClick={() => actions.processRefund(item)}>{t('admin.refunds.process')}</MobileButton>
                <MobileButton variant="danger" icon={<X aria-hidden="true" />} onClick={() => actions.rejectRefund(item)}>{t('admin.reject')}</MobileButton>
              </>
            ) : undefined}
          />
        )}
      />
      {actions.sheet}
    </MobileScreen>
  );
};

export const MobileAdminWithdrawalsScreen: React.FC = () => {
  const { t, money, dateTime } = useAdminText();
  const { states, openStates } = useCmBootstrap();
  const openWithdrawalStates = openStates('withdrawal');
  const [status, setStatus] = useState(useCmAdminParam('status', 'pending'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.withdrawals(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <MobileScreen title={t('admin.nav.withdrawals')} onRefresh={list.reload}>
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('withdrawal')} optionLabel={(option) => t(`admin.states.withdrawal.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noWithdrawals"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={`${t('admin.recordNumber', { id: item.id })} · ${money(item.amount, item.currency)}`}
            badge={<MobileStatusBadge status={item.status} prefix="admin.states.withdrawal" />}
            facts={[
              { label: t('admin.columnUser'), value: <AdminUserLink user={item.user} /> },
              { label: t('admin.columnMethod'), value: t(`admin.method.${item.method}`, { defaultValue: item.method }) },
              ...Object.entries(item.account_info ?? {}).filter(([, value]) => value !== null && value !== '').map(([key, value]) => ({
                label: t(`admin.fields.${key}`, { defaultValue: key }),
                value: String(value),
              })),
              { label: t('admin.withdrawals.requestedAt'), value: dateTime(item.created_at) },
            ]}
            note={item.admin_notes}
            actions={(
              <>
                {item.status === 'pending' && <MobileButton variant="primary" icon={<Check aria-hidden="true" />} onClick={() => actions.approveWithdrawal(item)}>{t('admin.approve')}</MobileButton>}
                {item.status === 'approved' && <MobileButton variant="primary" icon={<Banknote aria-hidden="true" />} onClick={() => actions.payWithdrawal(item)}>{t('admin.withdrawals.pay')}</MobileButton>}
                {openWithdrawalStates.includes(item.status) && <MobileButton variant="danger" icon={<X aria-hidden="true" />} onClick={() => actions.rejectWithdrawal(item)}>{t('admin.reject')}</MobileButton>}
              </>
            )}
          />
        )}
      />
      {actions.sheet}
    </MobileScreen>
  );
};

const PaymentsPanel: React.FC = () => {
  const { t, money, dateTime } = useAdminText();
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status', 'disputed'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.payments(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <>
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('payment')} optionLabel={(option) => t(`states.payment.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noPayments"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={`${t('admin.recordNumber', { id: item.id })} · ${money(item.amount, item.currency)}`}
            badge={<MobileStatusBadge status={item.status} prefix="states.payment" />}
            facts={[
              { label: t('admin.refunds.parties'), value: <><AdminUserLink user={item.payer} /> → <AdminUserLink user={item.payee} /></> },
              item.project_id ? { label: t('admin.columnProject'), value: item.project_title || t('admin.projectNumber', { id: item.project_id }) } : null,
              { label: t('admin.columnType'), value: t(`admin.payments.type.${item.type}`, { defaultValue: item.type }) },
              { label: t('admin.columnCreated'), value: dateTime(item.created_at) },
            ]}
            actions={item.status === 'disputed' ? actions.disputeResolutions.map((resolution) => (
              <MobileButton key={resolution} variant={resolution === 'refund' ? 'danger' : 'primary'} onClick={() => actions.resolveDispute(item, resolution)}>
                {t(`admin.payments.resolve.${resolution}`)}
              </MobileButton>
            )) : undefined}
          />
        )}
      />
      {actions.sheet}
    </>
  );
};

const EscrowsPanel: React.FC = () => {
  const { t, money, dateTime } = useAdminText();
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const filters = useMemo(() => ({ status, project_id: projectId }), [status, projectId]);
  const list = useCmAdminList((query) => cmAdminApi.escrows(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <>
      <AdminSearch value={projectId} onApply={setProjectId} placeholder={t('admin.payments.projectId')} inputMode="numeric" />
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('escrow')} optionLabel={(option) => t(`admin.states.escrow.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noEscrows"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={`${t('admin.recordNumber', { id: item.id })} · ${money(item.amount, item.currency)}`}
            badge={<MobileStatusBadge status={item.status} prefix="admin.states.escrow" />}
            facts={[
              { label: t('admin.columnProject'), value: item.project_title || (item.project_id ? t('admin.projectNumber', { id: item.project_id }) : t('common.unavailable')) },
              { label: t('admin.payments.funder'), value: <AdminUserLink user={item.payer} /> },
              { label: t('admin.payments.released'), value: money(item.released_amount, item.currency) },
              { label: t('admin.payments.refunded'), value: money(item.refunded_amount, item.currency) },
              { label: t('admin.payments.remaining'), value: <strong>{money(item.remaining_amount, item.currency)}</strong> },
              { label: t('admin.columnCreated'), value: dateTime(item.created_at) },
            ]}
            actions={item.refundable ? (
              <MobileButton variant="danger" icon={<RotateCcw aria-hidden="true" />} onClick={() => actions.refundEscrow(item)}>{t('admin.payments.escrowRefund.action')}</MobileButton>
            ) : undefined}
          />
        )}
      />
      {actions.sheet}
    </>
  );
};

type PaymentsTab = 'payments' | 'escrows';

/** Payments queue (disputed payments are resolved here) and the escrow holdings with their refunds. */
export const MobileAdminPaymentsScreen: React.FC = () => {
  const { t } = useAdminText();
  const [tab, setTab] = useState<PaymentsTab>(useCmAdminParam('tab') === 'escrows' ? 'escrows' : 'payments');

  return (
    <MobileScreen title={t('admin.nav.payments')}>
      <MobilePills<PaymentsTab>
        ariaLabel={t('admin.nav.payments')}
        value={tab}
        onChange={setTab}
        options={[{ value: 'payments', label: t('admin.payments.tab.payments') }, { value: 'escrows', label: t('admin.payments.tab.escrows') }]}
      />
      <p className="cmm-muted">{t(`admin.payments.tabHint.${tab}`)}</p>
      {tab === 'payments' ? <PaymentsPanel /> : <EscrowsPanel />}
    </MobileScreen>
  );
};
