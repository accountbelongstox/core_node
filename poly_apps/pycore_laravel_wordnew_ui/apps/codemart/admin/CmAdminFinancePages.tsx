import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Banknote, Check, RotateCcw, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmAdminApi } from './CmAdminApi';
import {
  CmAdminDate,
  CmAdminKeyValues,
  CmAdminListState,
  CmAdminMoney,
  CmAdminNotice,
  CmAdminPageHeader,
  CmAdminPager,
  CmAdminSearch,
  CmAdminSelect,
  CmAdminStatus,
  CmAdminTable,
  CmAdminToolbar,
  CmAdminUserLink,
  useCmAdminAction,
  useCmAdminFormat,
  useCmAdminList,
  useCmAdminParam,
} from './CmAdminShared';
import {
  CM_ADMIN_DEPOSIT_STATUSES,
  CM_ADMIN_DISPUTE_RESOLUTIONS,
  CM_ADMIN_ESCROW_STATUSES,
  CM_ADMIN_PAYMENT_STATUSES,
  CM_ADMIN_PAYMENT_TYPES,
  CM_ADMIN_PROJECT_STATUSES,
  CM_ADMIN_REFUND_STATUSES,
  CM_ADMIN_WITHDRAWAL_OPEN_STATUSES,
  CM_ADMIN_WITHDRAWAL_STATUSES,
  type CmAdminDepositRow,
  type CmAdminDisputeResolution,
  type CmAdminPaymentRow,
  type CmAdminProjectRow,
  type CmAdminRefundRow,
  type CmAdminUserSummary,
  type CmAdminWithdrawalRow,
} from './CmAdminTypes';

const ADMIN_ACTIVITY_PATH = '/codemart/admin/activity';
const DANGER_PROJECT_TARGETS = ['cancelled', 'archived'];

function projectActivityPath(projectId: number): string {
  return `${ADMIN_ACTIVITY_PATH}?resource_type=project&resource_id=${projectId}`;
}

/** Display name used inside confirmation sentences. */
function useCmAdminUserName() {
  const { t } = useTranslation('cm');
  return (user: CmAdminUserSummary | null | undefined, userId?: number | null): string =>
    user?.username || user?.name || (userId ? t('admin.userNumber', { id: userId }) : t('admin.unknownUser'));
}

const CmAdminProjectRef: React.FC<{ projectId: number | null | undefined; title?: string | null }> = ({ projectId, title }) => {
  const { t } = useTranslation('cm');
  if (!projectId) return <>{t('common.unavailable')}</>;
  return (
    <Link className="cm-workspace-link" to={projectActivityPath(projectId)}>
      {title || t('admin.projectNumber', { id: projectId })}
    </Link>
  );
};

export const CmAdminDepositsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const userName = useCmAdminUserName();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.deposits(query), filters);
  const action = useCmAdminAction(list.reload);

  const params = (item: CmAdminDepositRow) => ({
    id: item.id,
    amount: format.money(item.amount),
    user: userName(item.user, item.user_id),
    role: t(`roles.${item.role_type}`, { defaultValue: item.role_type }),
  });

  const confirm = (item: CmAdminDepositRow): void => action.ask({
    title: t('admin.deposits.confirmTitle', params(item)),
    body: t('admin.deposits.confirmBody', params(item)),
    confirmLabel: t('admin.confirmDeposit'),
    successKey: 'admin.depositConfirmed',
    run: () => cmAdminApi.confirmDeposit(item.id),
  });

  const reject = (item: CmAdminDepositRow): void => action.ask({
    title: t('admin.deposits.rejectTitle', params(item)),
    body: t('admin.deposits.rejectBody', params(item)),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.deposits.rejected',
    run: (notes) => cmAdminApi.rejectDeposit(item.id, notes),
  });

  const refund = (item: CmAdminDepositRow): void => action.ask({
    title: t('admin.deposits.refundTitle', params(item)),
    body: t('admin.deposits.refundBody', params(item)),
    confirmLabel: t('admin.deposits.refund'),
    tone: 'danger',
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.deposits.refunded',
    run: (notes) => cmAdminApi.refundDeposit(item.id, notes),
  });

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.deposits" purposeKey="admin.purpose.deposits" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_DEPOSIT_STATUSES}
          optionLabel={(option) => t(`admin.states.deposit.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noDeposits" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.nav.deposits')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnUser')}</th>
              <th>{t('admin.columnRole')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.columnMethod')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnCreated')}</th>
              <th>{t('admin.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td><CmAdminUserLink user={item.user} userId={item.user_id} /></td>
                <td>{t(`roles.${item.role_type}`, { defaultValue: item.role_type })}</td>
                <td><CmAdminMoney amount={item.amount} /></td>
                <td>{t(`admin.method.${item.payment_method}`, { defaultValue: item.payment_method })}</td>
                <td className="cm-admin-status-cell">
                  <CmAdminStatus status={item.status} group="admin.states.deposit" />
                  {item.admin_notes && <small className="cm-admin-sub">{item.admin_notes}</small>}
                </td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} stacked /></td>
                <td>
                  <div className="cm-table-actions">
                    {item.status === 'pending' && (
                      <>
                        <button type="button" className="cm-workspace-button is-primary" onClick={() => confirm(item)}>
                          <Check aria-hidden="true" /> {t('admin.confirmDeposit')}
                        </button>
                        <button type="button" className="cm-workspace-button is-danger" onClick={() => reject(item)}>
                          <X aria-hidden="true" /> {t('admin.reject')}
                        </button>
                      </>
                    )}
                    {item.status === 'paid' && (
                      <button type="button" className="cm-workspace-button is-danger" onClick={() => refund(item)}>
                        <RotateCcw aria-hidden="true" /> {t('admin.deposits.refund')}
                      </button>
                    )}
                    {item.status !== 'pending' && item.status !== 'paid' && <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};

export const CmAdminRefundsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const userName = useCmAdminUserName();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.refunds(query), filters);
  const action = useCmAdminAction(list.reload);

  const params = (item: CmAdminRefundRow) => ({
    id: item.id,
    payment: item.payment_id,
    amount: format.money(item.amount, item.currency),
    payer: userName(item.payer),
    payee: userName(item.payee),
    requester: userName(item.requester, item.requested_by),
  });

  const approve = (item: CmAdminRefundRow): void => action.ask({
    title: t('admin.refunds.approveTitle', params(item)),
    body: t('admin.refunds.approveBody', params(item)),
    confirmLabel: t('admin.approve'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.refunds.approved',
    run: (notes) => cmAdminApi.approveRefund(item.id, notes),
  });

  const reject = (item: CmAdminRefundRow): void => action.ask({
    title: t('admin.refunds.rejectTitle', params(item)),
    body: t('admin.refunds.rejectBody', params(item)),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.refunds.rejected',
    run: (notes) => cmAdminApi.rejectRefund(item.id, notes),
  });

  const processItem = (item: CmAdminRefundRow): void => action.ask({
    title: t('admin.refunds.processTitle', params(item)),
    body: t('admin.refunds.processBody', params(item)),
    confirmLabel: t('admin.refunds.process'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.refunds.processed',
    run: (notes) => cmAdminApi.processRefund(item.id, notes),
  });

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.refunds" purposeKey="admin.purpose.refunds" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_REFUND_STATUSES}
          optionLabel={(option) => t(`admin.states.refund.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noRefunds" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.nav.refunds')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnPayment')}</th>
              <th>{t('admin.refunds.parties')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnReason')}</th>
              <th>{t('admin.refunds.requestedAt')}</th>
              <th>{t('admin.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td className="cm-admin-nowrap">
                  {t('admin.paymentNumber', { id: item.payment_id })}
                  {item.project_id && <small className="cm-admin-sub"><CmAdminProjectRef projectId={item.project_id} /></small>}
                </td>
                <td className="cm-admin-nowrap">
                  <CmAdminUserLink user={item.payer} /> → <CmAdminUserLink user={item.payee} />
                  {item.requester && item.requester.id !== item.payer?.id && (
                    <small className="cm-admin-sub">{t('admin.refunds.requestedBy')} <CmAdminUserLink user={item.requester} /></small>
                  )}
                </td>
                <td><CmAdminMoney amount={item.amount} currency={item.currency} /></td>
                <td className="cm-admin-status-cell">
                  <CmAdminStatus status={item.status} group="admin.states.refund" />
                  {item.admin_notes && <small className="cm-admin-sub">{item.admin_notes}</small>}
                </td>
                <td className="cm-admin-wide">
                  {item.reason ?? t('common.unavailable')}
                  {item.notes && <small className="cm-admin-sub">{item.notes}</small>}
                </td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.requested_at} stacked /></td>
                <td>
                  <div className="cm-table-actions">
                    {item.status === 'pending' && (
                      <>
                        <button type="button" className="cm-workspace-button is-primary" onClick={() => approve(item)}>
                          <Check aria-hidden="true" /> {t('admin.approve')}
                        </button>
                        <button type="button" className="cm-workspace-button is-danger" onClick={() => reject(item)}>
                          <X aria-hidden="true" /> {t('admin.reject')}
                        </button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <>
                        <button type="button" className="cm-workspace-button is-primary" onClick={() => processItem(item)}>
                          <RotateCcw aria-hidden="true" /> {t('admin.refunds.process')}
                        </button>
                        <button type="button" className="cm-workspace-button is-danger" onClick={() => reject(item)}>
                          <X aria-hidden="true" /> {t('admin.reject')}
                        </button>
                      </>
                    )}
                    {item.status !== 'pending' && item.status !== 'approved' && <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};

export const CmAdminWithdrawalsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const userName = useCmAdminUserName();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.withdrawals(query), filters);
  const action = useCmAdminAction(list.reload);

  const params = (item: CmAdminWithdrawalRow) => ({
    id: item.id,
    amount: format.money(item.amount, item.currency),
    user: userName(item.user),
  });

  const approve = (item: CmAdminWithdrawalRow): void => action.ask({
    title: t('admin.withdrawals.approveTitle', params(item)),
    body: t('admin.withdrawals.approveBody', params(item)),
    confirmLabel: t('admin.approve'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.withdrawals.approved',
    run: (notes) => cmAdminApi.approveWithdrawal(item.id, notes),
  });

  const reject = (item: CmAdminWithdrawalRow): void => action.ask({
    title: t('admin.withdrawals.rejectTitle', params(item)),
    body: t('admin.withdrawals.rejectBody', params(item)),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.dialog.reasonForUser'),
    successKey: 'admin.withdrawals.rejected',
    run: (notes) => cmAdminApi.rejectWithdrawal(item.id, notes),
  });

  const pay = (item: CmAdminWithdrawalRow): void => action.ask({
    title: t('admin.withdrawals.payTitle', params(item)),
    body: t('admin.withdrawals.payBody', params(item)),
    confirmLabel: t('admin.withdrawals.pay'),
    reason: 'optional',
    reasonLabel: t('admin.withdrawals.payNotes'),
    successKey: 'admin.withdrawals.paid',
    run: (notes) => cmAdminApi.payWithdrawal(item.id, notes),
  });

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.withdrawals" purposeKey="admin.purpose.withdrawals" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_WITHDRAWAL_STATUSES}
          optionLabel={(option) => t(`admin.states.withdrawal.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noWithdrawals" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.nav.withdrawals')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnUser')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.withdrawals.account')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.withdrawals.requestedAt')}</th>
              <th>{t('admin.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td><CmAdminUserLink user={item.user} /></td>
                <td><CmAdminMoney amount={item.amount} currency={item.currency} /></td>
                <td className="cm-admin-wide">
                  <strong className="cm-admin-cell-title">{t(`admin.method.${item.method}`, { defaultValue: item.method })}</strong>
                  <CmAdminKeyValues value={item.account_info} />
                </td>
                <td className="cm-admin-status-cell">
                  <CmAdminStatus status={item.status} group="admin.states.withdrawal" />
                  {item.admin_notes && <small className="cm-admin-sub">{item.admin_notes}</small>}
                </td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} stacked /></td>
                <td>
                  <div className="cm-table-actions">
                    {item.status === 'pending' && (
                      <button type="button" className="cm-workspace-button is-primary" onClick={() => approve(item)}>
                        <Check aria-hidden="true" /> {t('admin.approve')}
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button type="button" className="cm-workspace-button is-primary" onClick={() => pay(item)}>
                        <Banknote aria-hidden="true" /> {t('admin.withdrawals.pay')}
                      </button>
                    )}
                    {(CM_ADMIN_WITHDRAWAL_OPEN_STATUSES as readonly string[]).includes(item.status) ? (
                      <button type="button" className="cm-workspace-button is-danger" onClick={() => reject(item)}>
                        <X aria-hidden="true" /> {t('admin.reject')}
                      </button>
                    ) : <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};

const CmAdminPaymentsTable: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const userName = useCmAdminUserName();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [type, setType] = useState(useCmAdminParam('type'));
  const filters = useMemo(() => ({ status, type }), [status, type]);
  const list = useCmAdminList((query) => cmAdminApi.payments(query), filters);
  const action = useCmAdminAction(list.reload);

  const resolve = (item: CmAdminPaymentRow, resolution: CmAdminDisputeResolution): void => {
    const params = {
      id: item.id,
      amount: format.money(item.amount, item.currency),
      payer: userName(item.payer),
      payee: userName(item.payee),
    };
    action.ask({
      title: t(`admin.payments.resolve.${resolution}Title`, params),
      body: t(`admin.payments.resolve.${resolution}Body`, params),
      confirmLabel: t(`admin.payments.resolve.${resolution}`),
      tone: resolution === 'refund' ? 'danger' : 'primary',
      reason: 'optional',
      reasonLabel: t('admin.dialog.notes'),
      successKey: 'admin.payments.resolved',
      run: (notes) => cmAdminApi.resolveDispute(item.id, resolution, notes),
    });
  };

  return (
    <>
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_PAYMENT_STATUSES}
          optionLabel={(option) => t(`states.payment.${option}`)}
        />
        <CmAdminSelect
          labelKey="admin.payments.filterType"
          value={type}
          onChange={setType}
          options={CM_ADMIN_PAYMENT_TYPES}
          optionLabel={(option) => t(`admin.payments.type.${option}`)}
          allKey="admin.allTypes"
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noPayments" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.payments.tab.payments')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.refunds.parties')}</th>
              <th>{t('admin.columnProject')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.columnType')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnCreated')}</th>
              <th>{t('admin.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td className="cm-admin-nowrap"><CmAdminUserLink user={item.payer} /> → <CmAdminUserLink user={item.payee} /></td>
                <td className="cm-admin-nowrap"><CmAdminProjectRef projectId={item.project_id} /></td>
                <td><CmAdminMoney amount={item.amount} currency={item.currency} /></td>
                <td>{t(`admin.payments.type.${item.type}`, { defaultValue: item.type })}</td>
                <td><CmAdminStatus status={item.status} group="states.payment" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} stacked /></td>
                <td>
                  {item.status === 'disputed' ? (
                    <div className="cm-table-actions">
                      {CM_ADMIN_DISPUTE_RESOLUTIONS.map((resolution) => (
                        <button
                          key={resolution}
                          type="button"
                          className={`cm-workspace-button ${resolution === 'refund' ? 'is-danger' : 'is-primary'}`}
                          onClick={() => resolve(item, resolution)}
                        >
                          {t(`admin.payments.resolve.${resolution}`)}
                        </button>
                      ))}
                    </div>
                  ) : <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </>
  );
};

const CmAdminEscrowsTable: React.FC = () => {
  const { t } = useTranslation('cm');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const filters = useMemo(() => ({ status, project_id: projectId }), [status, projectId]);
  const list = useCmAdminList((query) => cmAdminApi.escrows(query), filters);

  return (
    <>
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_ESCROW_STATUSES}
          optionLabel={(option) => t(`admin.states.escrow.${option}`)}
        />
        <CmAdminSearch labelKey="admin.payments.projectId" value={projectId} onApply={setProjectId} icon={false} inputMode="numeric" />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noEscrows" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.payments.tab.escrows')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnProject')}</th>
              <th>{t('admin.payments.funder')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.payments.released')}</th>
              <th>{t('admin.payments.refunded')}</th>
              <th>{t('admin.payments.remaining')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnCreated')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td className="cm-admin-wide"><CmAdminProjectRef projectId={item.project_id} title={item.project_title} /></td>
                <td><CmAdminUserLink user={item.payer} /></td>
                <td><CmAdminMoney amount={item.amount} currency={item.currency} /></td>
                <td><CmAdminMoney amount={item.released_amount} currency={item.currency} /></td>
                <td><CmAdminMoney amount={item.refunded_amount} currency={item.currency} /></td>
                <td><strong><CmAdminMoney amount={item.remaining_amount} currency={item.currency} /></strong></td>
                <td><CmAdminStatus status={item.status} group="admin.states.escrow" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} stacked /></td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
    </>
  );
};

export const CmAdminPaymentsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [tab, setTab] = useState<'payments' | 'escrows'>(useCmAdminParam('tab') === 'escrows' ? 'escrows' : 'payments');

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.payments" purposeKey="admin.purpose.payments" />
      <div className="cm-tabs cm-admin-tabs" role="tablist" aria-label={t('admin.nav.payments')}>
        {(['payments', 'escrows'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'is-active' : ''}
            onClick={() => setTab(key)}
          >
            {t(`admin.payments.tab.${key}`)}
          </button>
        ))}
      </div>
      <p className="cm-admin-tab-hint">{t(`admin.payments.tabHint.${tab}`)}</p>
      {tab === 'payments' ? <CmAdminPaymentsTable /> : <CmAdminEscrowsTable />}
    </main>
  );
};

export const CmAdminProjectsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const userName = useCmAdminUserName();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [clientId, setClientId] = useState(useCmAdminParam('client_id'));
  const filters = useMemo(() => ({ status, search, client_id: clientId }), [status, search, clientId]);
  const list = useCmAdminList((query) => cmAdminApi.projects(query), filters);
  const action = useCmAdminAction(list.reload);

  const intervene = (item: CmAdminProjectRow, target: string): void => {
    const targetLabel = t(`states.project.${target}`, { defaultValue: target });
    action.ask({
      title: t('admin.projects.changeTitle', { title: item.title, status: targetLabel }),
      body: [
        t('admin.projects.changeBody', {
          from: t(`states.project.${item.status}`, { defaultValue: item.status }),
          to: targetLabel,
          client: userName(item.client, item.client_id),
        }),
        t(`admin.projects.effect.${target}`, { defaultValue: '' }),
      ].filter(Boolean).join(' '),
      confirmLabel: t(`admin.projects.action.${target}`, { defaultValue: targetLabel }),
      tone: DANGER_PROJECT_TARGETS.includes(target) ? 'danger' : 'primary',
      reason: 'required',
      successKey: 'admin.projects.updated',
      run: (reason) => cmAdminApi.setProjectStatus(item.id, target, reason),
    });
  };

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.projects" purposeKey="admin.purpose.projects" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchProjects" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_PROJECT_STATUSES}
          optionLabel={(option) => t(`states.project.${option}`)}
        />
        <CmAdminSearch labelKey="admin.projects.clientId" value={clientId} onApply={setClientId} icon={false} inputMode="numeric" />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noProjects" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.nav.projects')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnTitle')}</th>
              <th>{t('admin.columnClient')}</th>
              <th>{t('admin.columnBudget')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnCreated')}</th>
              <th>{t('admin.projects.intervene')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td className="cm-admin-wide">
                  <strong className="cm-admin-cell-title">{item.title}</strong>
                  <small className="cm-admin-sub">
                    <Link className="cm-workspace-link" to={projectActivityPath(item.id)}>{t('admin.projects.history')}</Link>
                  </small>
                </td>
                <td><CmAdminUserLink user={item.client} userId={item.client_id} /></td>
                <td><CmAdminMoney amount={item.budget} currency={item.currency} /></td>
                <td><CmAdminStatus status={item.status} group="states.project" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} dateOnly /></td>
                <td>
                  <div className="cm-table-actions">
                    {item.admin_transitions.length === 0 && <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                    {item.admin_transitions.map((target) => (
                      <button
                        key={target}
                        type="button"
                        className={`cm-workspace-button ${DANGER_PROJECT_TARGETS.includes(target) ? 'is-danger' : ''}`}
                        onClick={() => intervene(item, target)}
                      >
                        {target === 'cancelled' && <Ban aria-hidden="true" />}
                        {t(`admin.projects.action.${target}`, { defaultValue: target })}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};
