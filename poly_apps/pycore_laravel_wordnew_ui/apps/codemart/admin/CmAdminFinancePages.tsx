import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Banknote, Check, RotateCcw, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CM_ADMIN_ROUTE, cmRouteWithQuery } from '../components/public-home/cmPublicRoutes';
import { CmListState, CmNotice } from '../components/workspace/CmStateViews';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { cmAdminApi } from './CmAdminApi';
import { useCmAdminActionBuilders } from './useCmAdminActions';
import {
  CmAdminDate,
  CmAdminKeyValues,
  CmAdminMoney,
  CmAdminSearch,
  CmAdminSelect,
  CmAdminTable,
  CmAdminToolbar,
  CmAdminUserLink,
  useCmAdminAction,
  useCmAdminList,
  useCmAdminParam,
} from './CmAdminShared';
function projectActivityPath(projectId: number): string {
  return cmRouteWithQuery(CM_ADMIN_ROUTE.activity, { resource_type: 'project', resource_id: projectId });
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
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.deposits(query), filters);
  const action = useCmAdminAction(list.reload);

  const actions = useCmAdminActionBuilders(action.ask);
  const { confirmDeposit: confirm, rejectDeposit: reject, refundDeposit: refund } = actions;

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.deposits" purposeKey="admin.purpose.deposits" onRefresh={() => void list.reload()} />
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('deposit')}
          optionLabel={(option) => t(`admin.states.deposit.${option}`)}
        />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noDeposits" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.nav.deposits')} actions>
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
                  <CmStatusBadge status={item.status} prefix="admin.states.deposit" />
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </main>
  );
};

export const CmAdminRefundsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.refunds(query), filters);
  const action = useCmAdminAction(list.reload);

  const actions = useCmAdminActionBuilders(action.ask);
  const { approveRefund: approve, rejectRefund: reject, processRefund: processItem } = actions;

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.refunds" purposeKey="admin.purpose.refunds" onRefresh={() => void list.reload()} />
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('refund')}
          optionLabel={(option) => t(`admin.states.refund.${option}`)}
        />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noRefunds" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.nav.refunds')} actions>
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
                  <CmStatusBadge status={item.status} prefix="admin.states.refund" />
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </main>
  );
};

export const CmAdminWithdrawalsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { states, openStates } = useCmBootstrap();
  const openWithdrawalStates = openStates('withdrawal');
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ status }), [status]);
  const list = useCmAdminList((query) => cmAdminApi.withdrawals(query), filters);
  const action = useCmAdminAction(list.reload);

  const actions = useCmAdminActionBuilders(action.ask);
  const { approveWithdrawal: approve, rejectWithdrawal: reject, payWithdrawal: pay } = actions;

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.withdrawals" purposeKey="admin.purpose.withdrawals" onRefresh={() => void list.reload()} />
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('withdrawal')}
          optionLabel={(option) => t(`admin.states.withdrawal.${option}`)}
        />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noWithdrawals" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.nav.withdrawals')} actions>
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
                  <CmStatusBadge status={item.status} prefix="admin.states.withdrawal" />
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
                    {openWithdrawalStates.includes(item.status) ? (
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </main>
  );
};

const CmAdminPaymentsTable: React.FC = () => {
  const { t } = useTranslation('cm');
  const { states, policyList } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [type, setType] = useState(useCmAdminParam('type'));
  const filters = useMemo(() => ({ status, type }), [status, type]);
  const list = useCmAdminList((query) => cmAdminApi.payments(query), filters);
  const action = useCmAdminAction(list.reload);

  const { resolveDispute: resolve, disputeResolutions } = useCmAdminActionBuilders(action.ask);

  return (
    <>
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('payment')}
          optionLabel={(option) => t(`states.payment.${option}`)}
        />
        <CmAdminSelect
          labelKey="admin.payments.filterType"
          value={type}
          onChange={setType}
          options={policyList('payment_types')}
          optionLabel={(option) => t(`admin.payments.type.${option}`)}
          allKey="admin.allTypes"
        />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noPayments" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.payments.tab.payments')} actions>
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
                <td className="cm-admin-wide"><CmAdminProjectRef projectId={item.project_id} title={item.project_title} /></td>
                <td><CmAdminMoney amount={item.amount} currency={item.currency} /></td>
                <td>{t(`admin.payments.type.${item.type}`, { defaultValue: item.type })}</td>
                <td><CmStatusBadge status={item.status} prefix="states.payment" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} stacked /></td>
                <td>
                  {item.status === 'disputed' ? (
                    <div className="cm-table-actions">
                      {disputeResolutions.map((resolution) => (
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </>
  );
};

const CmAdminEscrowsTable: React.FC = () => {
  const { t } = useTranslation('cm');
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const filters = useMemo(() => ({ status, project_id: projectId }), [status, projectId]);
  const list = useCmAdminList((query) => cmAdminApi.escrows(query), filters);
  const action = useCmAdminAction(list.reload);

  const { refundEscrow: refund } = useCmAdminActionBuilders(action.ask);

  return (
    <>
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('escrow')}
          optionLabel={(option) => t(`admin.states.escrow.${option}`)}
        />
        <CmAdminSearch labelKey="admin.payments.projectId" value={projectId} onApply={setProjectId} icon={false} inputMode="numeric" />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noEscrows" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.payments.tab.escrows')} actions>
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
              <th>{t('admin.columnActions')}</th>
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
                <td><CmStatusBadge status={item.status} prefix="admin.states.escrow" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} stacked /></td>
                <td>
                  <div className="cm-table-actions">
                    {item.refundable ? (
                      <button type="button" className="cm-workspace-button is-danger" onClick={() => refund(item)}>
                        <RotateCcw aria-hidden="true" /> {t('admin.payments.escrowRefund.action')}
                      </button>
                    ) : (
                      <span className="cm-admin-muted">{t('admin.noAction')}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </>
  );
};

export const CmAdminPaymentsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [tab, setTab] = useState<'payments' | 'escrows'>(useCmAdminParam('tab') === 'escrows' ? 'escrows' : 'payments');

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.payments" purposeKey="admin.purpose.payments" />
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
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [clientId, setClientId] = useState(useCmAdminParam('client_id'));
  const filters = useMemo(() => ({ status, search, client_id: clientId }), [status, search, clientId]);
  const list = useCmAdminList((query) => cmAdminApi.projects(query), filters);
  const action = useCmAdminAction(list.reload);

  const { setProjectStatus: intervene, closedProjectStates } = useCmAdminActionBuilders(action.ask);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.projects" purposeKey="admin.purpose.projects" onRefresh={() => void list.reload()} />
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchProjects" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('project')}
          optionLabel={(option) => t(`states.project.${option}`)}
        />
        <CmAdminSearch labelKey="admin.projects.clientId" value={clientId} onApply={setClientId} icon={false} inputMode="numeric" />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noProjects" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.nav.projects')} actions>
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
                <td><CmStatusBadge status={item.status} prefix="states.project" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.created_at} dateOnly /></td>
                <td>
                  <div className="cm-table-actions">
                    {item.admin_transitions.length === 0 && <span className="cm-admin-muted">{t('admin.noAction')}</span>}
                    {item.admin_transitions.map((target) => (
                      <button
                        key={target}
                        type="button"
                        className={`cm-workspace-button ${closedProjectStates.includes(target) ? 'is-danger' : ''}`}
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </main>
  );
};
