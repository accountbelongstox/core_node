import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmAdminApi } from './CmAdminApi';
import { CmAdminKycDocumentViewer } from './CmAdminPages';
import {
  CmAdminActivityTable,
  CmAdminDate,
  CmAdminMoney,
  CmAdminNotice,
  CmAdminPageHeader,
  CmAdminStatus,
  CmAdminTable,
  useCmAdminAction,
} from './CmAdminShared';
import {
  CM_ADMIN_GRANT_STATUSES,
  CM_ADMIN_ROLE_REASON_REQUIRED,
  CM_ADMIN_ROLE_TYPES,
  type CmAdminUserDetail,
  type CmAdminUserRole,
} from './CmAdminTypes';

const ADMIN_USERS_PATH = '/codemart/admin/users';
const ADMIN_ACTIVITY_PATH = '/codemart/admin/activity';

export const CmAdminUserDetailPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { userId } = useParams();
  const numericId = Number(userId);
  const [detail, setDetail] = useState<CmAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantRole, setGrantRole] = useState('');
  const [grantStatus, setGrantStatus] = useState<string>('pending');

  const load = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setError(t('errors.user_not_found'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const response = await cmAdminApi.userDetail(numericId);
    if (response.success && response.data) {
      setDetail(response.data);
    } else {
      setDetail(null);
      setError(cmErrorMessage(t, response, 'admin.loadFailed'));
    }
    setLoading(false);
  }, [numericId, t]);

  const action = useCmAdminAction(load);

  useEffect(() => {
    void load();
  }, [load]);

  const heldRoles = new Set((detail?.roles ?? []).map((role) => role.role_type));
  const grantableRoles = CM_ADMIN_ROLE_TYPES.filter((role) => !heldRoles.has(role));

  const changeRole = (role: CmAdminUserRole, target: string): void => {
    const reasonRequired = (CM_ADMIN_ROLE_REASON_REQUIRED as readonly string[]).includes(target);
    const roleLabel = t(`roles.${role.role_type}`, { defaultValue: role.role_type });
    const targetLabel = t(`states.role.${target}`, { defaultValue: target });
    action.ask({
      title: t('admin.userDetail.changeRoleTitle', { role: roleLabel, status: targetLabel }),
      body: t('admin.userDetail.changeRoleBody', {
        user: detail?.account.username ?? numericId,
        from: t(`states.role.${role.role_status}`, { defaultValue: role.role_status }),
        to: targetLabel,
      }),
      confirmLabel: t(`admin.userDetail.transition.${target}`, { defaultValue: targetLabel }),
      tone: reasonRequired ? 'danger' : 'primary',
      reason: reasonRequired ? 'required' : 'optional',
      successKey: 'admin.roleUpdated',
      run: (reason) => cmAdminApi.setRoleStatus(numericId, role.role_type, target, reason),
    });
  };

  const grant = (): void => {
    if (!grantRole) return;
    const roleLabel = t(`roles.${grantRole}`, { defaultValue: grantRole });
    action.ask({
      title: t('admin.userDetail.grantTitle', { role: roleLabel }),
      body: t('admin.userDetail.grantBody', {
        user: detail?.account.username ?? numericId,
        status: t(`states.role.${grantStatus}`),
      }),
      confirmLabel: t('admin.userDetail.grant'),
      reason: 'optional',
      successKey: 'admin.userDetail.granted',
      run: async (reason) => {
        const response = await cmAdminApi.grantRole(numericId, grantRole, grantStatus, reason);
        if (response.success) setGrantRole('');
        return response;
      },
    });
  };

  const account = detail?.account;
  const developer = detail?.profiles.developer;
  const client = detail?.profiles.client;

  return (
    <main className="cm-workspace-page">
      <Link className="cm-workspace-link cm-admin-back" to={ADMIN_USERS_PATH}>
        <ArrowLeft aria-hidden="true" /> {t('admin.userDetail.back')}
      </Link>
      <CmAdminPageHeader
        titleKey="admin.userDetail.title"
        purposeKey="admin.purpose.userDetail"
        title={account ? account.username : undefined}
        onRefresh={() => void load()}
      >
        {account && (
          <Link className="cm-workspace-button" to={`${ADMIN_ACTIVITY_PATH}?actor_id=${account.id}`}>
            {t('admin.userDetail.actorActivity')}
          </Link>
        )}
      </CmAdminPageHeader>
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      {loading ? (
        <p className="cm-admin-state" role="status">{t('common.loading')}</p>
      ) : error || !detail || !account ? (
        <div className="cm-admin-state" data-tone="error" role="alert">
          <p>{error ?? t('admin.loadFailed')}</p>
          <button type="button" className="cm-workspace-button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {t('admin.retry')}
          </button>
        </div>
      ) : (
        <>
          <section className="cm-admin-panel-grid">
            <article className="cm-admin-panel">
              <h3>{t('admin.userDetail.account')}</h3>
              <dl className="cm-admin-kv">
                <div><dt>{t('admin.columnUser')}</dt><dd>{account.username}</dd></div>
                <div><dt>{t('admin.userDetail.userId')}</dt><dd>{account.id}</dd></div>
                <div><dt>{t('admin.userDetail.name')}</dt><dd>{account.name ?? account.nickname ?? t('common.unavailable')}</dd></div>
                <div><dt>{t('admin.columnEmail')}</dt><dd>{account.email ?? t('common.unavailable')}</dd></div>
                <div><dt>{t('admin.columnLevel')}</dt><dd>{account.rolename ? t('admin.userDetail.levelValue', { level: account.rolelevel, name: account.rolename }) : account.rolelevel}</dd></div>
                <div><dt>{t('admin.userDetail.administrator')}</dt><dd>{t(account.is_admin ? 'admin.yes' : 'admin.no')}</dd></div>
                <div><dt>{t('admin.userDetail.emailVerified')}</dt><dd>{t(account.email_verified ? 'admin.yes' : 'admin.no')}</dd></div>
                <div><dt>{t('admin.userDetail.phoneVerified')}</dt><dd>{t(account.phone_verified ? 'admin.yes' : 'admin.no')}</dd></div>
                <div><dt>{t('admin.columnCreated')}</dt><dd><CmAdminDate value={account.created_at} dateOnly /></dd></div>
              </dl>
            </article>
            <article className="cm-admin-panel">
              <h3>{t('admin.userDetail.wallet')}</h3>
              <dl className="cm-admin-kv">
                <div><dt>{t('admin.userDetail.balance')}</dt><dd><CmAdminMoney amount={detail.wallet.balance} currency={detail.wallet.currency} /></dd></div>
                <div><dt>{t('admin.userDetail.available')}</dt><dd><CmAdminMoney amount={detail.wallet.available_balance} currency={detail.wallet.currency} /></dd></div>
                <div><dt>{t('admin.userDetail.frozen')}</dt><dd><CmAdminMoney amount={detail.wallet.frozen_balance} currency={detail.wallet.currency} /></dd></div>
              </dl>
            </article>
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.roles')}</h2>
            {detail.roles.length === 0 ? (
              <p className="cm-contract-note">{t('admin.userDetail.noRoles')}</p>
            ) : (
              <CmAdminTable>
                <thead>
                  <tr>
                    <th>{t('admin.columnRole')}</th>
                    <th>{t('admin.columnStatus')}</th>
                    <th>{t('admin.userDetail.deposit')}</th>
                    <th>{t('admin.userDetail.activatedAt')}</th>
                    <th>{t('admin.columnActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.roles.map((role) => (
                    <tr key={role.id}>
                      <td>{t(`roles.${role.role_type}`, { defaultValue: role.role_type })}</td>
                      <td><CmAdminStatus status={role.role_status} group="states.role" /></td>
                      <td><CmAdminMoney amount={role.deposit_amount} currency={detail.wallet.currency} /></td>
                      <td className="cm-admin-nowrap"><CmAdminDate value={role.role_activated_at} stacked /></td>
                      <td>
                        <div className="cm-table-actions">
                          {role.allowed_transitions.length === 0 && t('common.unavailable')}
                          {role.allowed_transitions.map((target) => (
                            <button
                              key={target}
                              type="button"
                              className={`cm-workspace-button ${(CM_ADMIN_ROLE_REASON_REQUIRED as readonly string[]).includes(target) ? 'is-danger' : 'is-primary'}`}
                              onClick={() => changeRole(role, target)}
                            >
                              {t(`admin.userDetail.transition.${target}`, { defaultValue: target })}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CmAdminTable>
            )}
            {grantableRoles.length > 0 && (
              <div className="cm-admin-inline-form">
                <label>
                  <span>{t('admin.userDetail.grantRole')}</span>
                  <select value={grantRole} onChange={(event) => setGrantRole(event.target.value)}>
                    <option value="">{t('admin.userDetail.chooseRole')}</option>
                    {grantableRoles.map((role) => (
                      <option key={role} value={role}>{t(`roles.${role}`)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('admin.userDetail.initialStatus')}</span>
                  <select value={grantStatus} onChange={(event) => setGrantStatus(event.target.value)}>
                    {CM_ADMIN_GRANT_STATUSES.map((status) => (
                      <option key={status} value={status}>{t(`states.role.${status}`)}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="cm-workspace-button is-primary" disabled={!grantRole} onClick={grant}>
                  <Plus aria-hidden="true" /> {t('admin.userDetail.grant')}
                </button>
              </div>
            )}
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.profiles')}</h2>
            <div className="cm-admin-panel-grid">
              <article className="cm-admin-panel">
                <h3>{t('roles.developer')}</h3>
                {developer ? (
                  <dl className="cm-admin-kv">
                    <div><dt>{t('admin.userDetail.company')}</dt><dd>{developer.company_name ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.skills')}</dt><dd>{Array.isArray(developer.skills) ? developer.skills.join(', ') : developer.skills ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.completedProjects')}</dt><dd>{developer.completed_projects}</dd></div>
                    <div><dt>{t('admin.userDetail.averageRating')}</dt><dd>{developer.average_rating}</dd></div>
                    <div><dt>{t('admin.userDetail.bio')}</dt><dd>{developer.bio ?? t('common.unavailable')}</dd></div>
                  </dl>
                ) : <p className="cm-contract-note">{t('admin.userDetail.noProfile')}</p>}
              </article>
              <article className="cm-admin-panel">
                <h3>{t('roles.client')}</h3>
                {client ? (
                  <dl className="cm-admin-kv">
                    <div><dt>{t('admin.userDetail.company')}</dt><dd>{client.company_name ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.industry')}</dt><dd>{client.industry ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.contactPerson')}</dt><dd>{client.contact_person ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.contactPhone')}</dt><dd>{client.contact_phone ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.website')}</dt><dd>{client.company_website ?? t('common.unavailable')}</dd></div>
                    <div><dt>{t('admin.userDetail.postedProjects')}</dt><dd>{client.posted_projects}</dd></div>
                  </dl>
                ) : <p className="cm-contract-note">{t('admin.userDetail.noProfile')}</p>}
              </article>
            </div>
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.kyc')}</h2>
            {detail.kyc.length === 0 ? (
              <p className="cm-contract-note">{t('admin.userDetail.noKyc')}</p>
            ) : (
              <div className="cm-card-list">
                {detail.kyc.map((item) => (
                  <article key={item.id} className="cm-record-card cm-admin-record">
                    <div className="cm-record-card__main">
                      <h2>{item.real_name}</h2>
                      <div className="cm-record-card__meta">
                        <span>{t('admin.recordNumber', { id: item.id })}</span>
                        <span>{t(`admin.kyc.identity.${item.identity_type}`, { defaultValue: item.identity_type })}</span>
                        <CmAdminStatus status={item.verification_status} group="states.kyc" />
                        <span><CmAdminDate value={item.submitted_at} /></span>
                      </div>
                      {item.verification_notes && <p>{t('admin.notesValue', { notes: item.verification_notes })}</p>}
                      <CmAdminKycDocumentViewer kycId={item.id} documents={item.documents} />
                    </div>
                    {item.reviewable && (
                      <div className="cm-record-card__actions">
                        <Link className="cm-workspace-button is-primary" to={`/codemart/admin/kyc?status=pending&search=${encodeURIComponent(account.username)}`}>
                          {t('admin.userDetail.reviewKyc')}
                        </Link>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.deposits')}</h2>
            {detail.deposits.length === 0 ? (
              <p className="cm-contract-note">{t('admin.userDetail.noDeposits')}</p>
            ) : (
              <CmAdminTable>
                <thead>
                  <tr>
                    <th>{t('admin.columnId')}</th>
                    <th>{t('admin.columnRole')}</th>
                    <th>{t('admin.columnAmount')}</th>
                    <th>{t('admin.columnMethod')}</th>
                    <th>{t('admin.columnStatus')}</th>
                    <th>{t('admin.columnPaidAt')}</th>
                    <th>{t('admin.columnCreated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.deposits.map((deposit) => (
                    <tr key={deposit.id}>
                      <td>{t('admin.recordNumber', { id: deposit.id })}</td>
                      <td>{t(`roles.${deposit.role_type}`, { defaultValue: deposit.role_type })}</td>
                      <td><CmAdminMoney amount={deposit.amount} currency={detail.wallet.currency} /></td>
                      <td>{t(`admin.method.${deposit.payment_method}`, { defaultValue: deposit.payment_method })}</td>
                      <td><CmAdminStatus status={deposit.status} group="admin.states.deposit" /></td>
                      <td className="cm-admin-nowrap"><CmAdminDate value={deposit.paid_at} stacked /></td>
                      <td className="cm-admin-nowrap"><CmAdminDate value={deposit.created_at} stacked /></td>
                    </tr>
                  ))}
                </tbody>
              </CmAdminTable>
            )}
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.projects')}</h2>
            {detail.projects.length === 0 ? (
              <p className="cm-contract-note">{t('admin.userDetail.noProjects')}</p>
            ) : (
              <CmAdminTable>
                <thead>
                  <tr>
                    <th>{t('admin.columnId')}</th>
                    <th>{t('admin.columnTitle')}</th>
                    <th>{t('admin.columnBudget')}</th>
                    <th>{t('admin.columnStatus')}</th>
                    <th>{t('admin.columnCreated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.projects.map((project) => (
                    <tr key={project.id}>
                      <td>{t('admin.recordNumber', { id: project.id })}</td>
                      <td>{project.title}</td>
                      <td><CmAdminMoney amount={project.budget} currency={project.currency} /></td>
                      <td><CmAdminStatus status={project.status} group="states.project" /></td>
                      <td><CmAdminDate value={project.created_at} dateOnly /></td>
                    </tr>
                  ))}
                </tbody>
              </CmAdminTable>
            )}
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.tasks')}</h2>
            {detail.tasks.length === 0 ? (
              <p className="cm-contract-note">{t('admin.userDetail.noTasks')}</p>
            ) : (
              <CmAdminTable>
                <thead>
                  <tr>
                    <th>{t('admin.columnId')}</th>
                    <th>{t('admin.columnTitle')}</th>
                    <th>{t('admin.columnBudget')}</th>
                    <th>{t('admin.columnStatus')}</th>
                    <th>{t('admin.userDetail.dueDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{t('admin.recordNumber', { id: task.id })}</td>
                      <td>{task.title}</td>
                      <td><CmAdminMoney amount={task.budget_allocation} currency={detail.wallet.currency} /></td>
                      <td><CmAdminStatus status={task.status} group="states.task" /></td>
                      <td><CmAdminDate value={task.due_date} dateOnly /></td>
                    </tr>
                  ))}
                </tbody>
              </CmAdminTable>
            )}
          </section>

          <section className="cm-admin-section">
            <h2>{t('admin.userDetail.recentActivity')}</h2>
            {detail.activity.length === 0 ? (
              <p className="cm-contract-note">{t('admin.noActivity')}</p>
            ) : (
              <CmAdminActivityTable rows={detail.activity} showActor={false} />
            )}
          </section>
        </>
      )}
      {action.dialog}
    </main>
  );
};

export default CmAdminUserDetailPage;
