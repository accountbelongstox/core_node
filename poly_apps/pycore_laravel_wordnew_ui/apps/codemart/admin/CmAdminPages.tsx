import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Eye,
  Inbox,
  ListChecks,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import adminConsoleImage from '../assets/images/admin-console.webp';
import { cmAdminApi } from './CmAdminApi';
import {
  CmAdminDate,
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
  CM_ADMIN_IDENTITY_TYPES,
  CM_ADMIN_KYC_DOCUMENTS,
  CM_ADMIN_KYC_STATUSES,
  CM_ADMIN_PROJECT_STATUSES,
  CM_ADMIN_ROLE_STATUSES,
  CM_ADMIN_ROLE_TYPES,
  type CmAdminKycDocument,
  type CmAdminKycRecord,
  type CmAdminOverviewData,
  type CmAdminPolicy,
} from './CmAdminTypes';

const ADMIN_BASE = '/codemart/admin';
const BANNER_WIDTH = 1280;
const BANNER_HEIGHT = 720;
const GLOSSARY_TERMS = ['deposit', 'escrow', 'dispute', 'refund', 'withdrawal', 'kyc', 'roleStatus', 'reviewer', 'testimonial'] as const;

type CmAdminQueue = {
  id: string;
  count: number;
  to: string;
  Icon: LucideIcon;
};

function queuesFor(overview: CmAdminOverviewData): CmAdminQueue[] {
  return [
    { id: 'kyc', count: overview.kyc_pending, to: `${ADMIN_BASE}/kyc?status=pending`, Icon: ShieldCheck },
    { id: 'deposits', count: overview.deposits_pending, to: `${ADMIN_BASE}/deposits?status=pending`, Icon: WalletCards },
    { id: 'refunds', count: overview.refunds_pending, to: `${ADMIN_BASE}/refunds?status=pending`, Icon: RotateCcw },
    { id: 'withdrawals', count: overview.withdrawals_pending, to: `${ADMIN_BASE}/withdrawals?status=pending`, Icon: Banknote },
    { id: 'roles', count: overview.roles_pending, to: `${ADMIN_BASE}/users?status=pending`, Icon: UserCog },
    { id: 'testimonials', count: overview.testimonials_pending, to: `${ADMIN_BASE}/testimonials?status=pending`, Icon: MessageSquareQuote },
    { id: 'contact', count: overview.contact_messages_new, to: `${ADMIN_BASE}/contact-messages?status=new`, Icon: Inbox },
  ];
}

export const CmAdminOverviewPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const [overview, setOverview] = useState<CmAdminOverviewData | null>(null);
  const [policy, setPolicy] = useState<CmAdminPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const [overviewResponse, policyResponse] = await Promise.all([cmAdminApi.overview(), cmAdminApi.policy()]);
    if (overviewResponse.success && overviewResponse.data) {
      setOverview(overviewResponse.data);
    } else {
      setOverview(null);
      setError(cmErrorMessage(t, overviewResponse, 'admin.loadFailed'));
    }
    setPolicy(policyResponse.success && policyResponse.data ? policyResponse.data : null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const queues = overview ? queuesFor(overview) : [];
  const openQueues = queues.filter((queue) => queue.count > 0);
  const clearQueues = queues.filter((queue) => queue.count === 0);
  const pendingTotal = openQueues.reduce((sum, queue) => sum + queue.count, 0);
  const projectCounts = overview?.projects_by_status ?? {};
  const projectStatuses = [
    ...CM_ADMIN_PROJECT_STATUSES.filter((status) => projectCounts[status]),
    ...Object.keys(projectCounts).filter((status) => !(CM_ADMIN_PROJECT_STATUSES as readonly string[]).includes(status)),
  ];

  const totals = overview ? [
    { key: 'users', value: overview.users_total, to: `${ADMIN_BASE}/users`, Icon: Users },
    { key: 'roleHolders', value: overview.codeMart_role_holders, to: `${ADMIN_BASE}/users?status=active`, Icon: UserCog },
    { key: 'projects', value: overview.projects_total, to: `${ADMIN_BASE}/projects`, Icon: BriefcaseBusiness },
    { key: 'tasks', value: overview.tasks_total, to: null, Icon: ListChecks },
    { key: 'reviewersPassed', value: overview.reviewer_applications_passed, to: `${ADMIN_BASE}/reviewer-applications?status=passed`, Icon: BadgeCheck },
  ] : [];

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader
        titleKey="admin.nav.overview"
        purposeKey="admin.purpose.overview"
        onRefresh={() => void load()}
        aside={(
          <img
            className="cm-admin-heading__image"
            src={adminConsoleImage}
            alt=""
            width={BANNER_WIDTH}
            height={BANNER_HEIGHT}
            decoding="async"
          />
        )}
      />
      {loading ? (
        <p className="cm-admin-state" role="status">{t('common.loading')}</p>
      ) : error || !overview ? (
        <div className="cm-admin-state" data-tone="error" role="alert">
          <p>{error ?? t('admin.loadFailed')}</p>
          <button type="button" className="cm-workspace-button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {t('admin.retry')}
          </button>
        </div>
      ) : (
        <>
          <section className="cm-admin-section" aria-labelledby="cm-admin-queues">
            <div className="cm-admin-section__head">
              <h2 id="cm-admin-queues">{t('admin.overview.pendingTitle')}</h2>
              <p>{pendingTotal > 0
                ? t('admin.overview.pendingSummary', { count: pendingTotal, total: format.number(pendingTotal) })
                : t('admin.overview.allClear')}</p>
            </div>
            {openQueues.length > 0 && (
              <div className="cm-admin-queue-grid">
                {openQueues.map((queue) => {
                  const Icon = queue.Icon;
                  return (
                    <Link key={queue.id} to={queue.to} className="cm-admin-queue" data-active="true">
                      <span className="cm-admin-queue__icon"><Icon aria-hidden="true" /></span>
                      <span className="cm-admin-queue__body">
                        <strong>{format.number(queue.count)}</strong>
                        <span>{t(`admin.overview.queue.${queue.id}.title`)}</span>
                        <small>{t(`admin.overview.queue.${queue.id}.hint`)}</small>
                      </span>
                      <span className="cm-admin-queue__go">
                        {t('admin.overview.openQueue')} <ArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
            {clearQueues.length > 0 && (
              <div className="cm-admin-clear-list">
                <span><CheckCircle2 aria-hidden="true" /> {t('admin.overview.noPending')}</span>
                {clearQueues.map((queue) => (
                  <Link key={queue.id} to={queue.to} className="cm-workspace-link">{t(`admin.overview.queue.${queue.id}.title`)}</Link>
                ))}
              </div>
            )}
          </section>

          <section className="cm-admin-section" aria-labelledby="cm-admin-totals">
            <h2 id="cm-admin-totals">{t('admin.overview.platformTitle')}</h2>
            <div className="cm-admin-counter-grid">
              {totals.map((card) => {
                const Icon = card.Icon;
                const content = (
                  <>
                    <Icon aria-hidden="true" />
                    <strong>{format.number(card.value ?? 0)}</strong>
                    <span>{t(`admin.metrics.${card.key}`)}</span>
                  </>
                );
                return card.to
                  ? <Link key={card.key} to={card.to} className="cm-admin-counter">{content}</Link>
                  : <div key={card.key} className="cm-admin-counter">{content}</div>;
              })}
            </div>
          </section>

          <section className="cm-admin-section" aria-labelledby="cm-admin-projects">
            <h2 id="cm-admin-projects">{t('admin.overview.projectsByStatus')}</h2>
            {projectStatuses.length === 0 ? (
              <p className="cm-admin-state">{t('admin.noProjectsAtAll')}</p>
            ) : (
              <div className="cm-admin-status-strip">
                {projectStatuses.map((status) => (
                  <Link key={status} to={`${ADMIN_BASE}/projects?status=${status}`} className="cm-admin-status-chip">
                    <CmAdminStatus status={status} group="states.project" />
                    <strong>{format.number(projectCounts[status] ?? 0)}</strong>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {!loading && policy && <CmAdminPolicyCard policy={policy} />}
      {!loading && <CmAdminGlossary />}
    </main>
  );
};

const CmAdminPolicyCard: React.FC<{ policy: CmAdminPolicy }> = ({ policy }) => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const commission = Number(policy.platform_commission_rate);
  const thresholdRows = [
    ...Object.entries(policy.architect_thresholds ?? {}).map(([key, value]) => ({ key: `architect.${key}`, value })),
    ...Object.entries(policy.reviewer_thresholds ?? {}).map(([key, value]) => ({ key: `reviewer.${key}`, value })),
  ];

  return (
    <section className="cm-admin-section" aria-labelledby="cm-admin-policy">
      <div className="cm-admin-section__head">
        <h2 id="cm-admin-policy">{t('admin.policy.title')}</h2>
        <p>{t('admin.policy.readOnly')}</p>
      </div>
      <div className="cm-admin-panel-grid">
        <article className="cm-admin-panel">
          <h3>{t('admin.policy.deposits')}</h3>
          <dl className="cm-admin-kv">
            {Object.entries(policy.deposit_amounts ?? {}).map(([role, amount]) => (
              <div key={role}>
                <dt>{t(`roles.${role}`, { defaultValue: role })}</dt>
                <dd><CmAdminMoney amount={amount} currency={policy.currency} /></dd>
              </div>
            ))}
            <div>
              <dt>{t('admin.policy.architectAdditional')}</dt>
              <dd><CmAdminMoney amount={policy.architect_additional_deposit} currency={policy.currency} /></dd>
            </div>
            <div>
              <dt>{t('admin.policy.commission')}</dt>
              <dd>{Number.isFinite(commission)
                ? new Intl.NumberFormat(format.language, { style: 'percent', maximumFractionDigits: 2 }).format(commission)
                : String(policy.platform_commission_rate)}</dd>
            </div>
          </dl>
        </article>
        <article className="cm-admin-panel">
          <h3>{t('admin.policy.thresholds')}</h3>
          <dl className="cm-admin-kv">
            {thresholdRows.map((row) => (
              <div key={row.key}>
                <dt>{t(`admin.policy.threshold.${row.key}`, { defaultValue: row.key })}</dt>
                <dd>{t(`admin.policy.thresholdValue.${row.key}`, { value: row.value, defaultValue: String(row.value) })}</dd>
              </div>
            ))}
            <div>
              <dt>{t('admin.policy.maxKycImage')}</dt>
              <dd>{t('admin.policy.sizeKb', { size: format.number(policy.max_kyc_image_size_kb) })}</dd>
            </div>
            <div>
              <dt>{t('admin.policy.maxAttachment')}</dt>
              <dd>{t('admin.policy.sizeKb', { size: format.number(policy.max_attachment_size_kb) })}</dd>
            </div>
          </dl>
        </article>
        <article className="cm-admin-panel">
          <h3>{t('admin.policy.roleTransitions')}</h3>
          <dl className="cm-admin-kv">
            {Object.entries(policy.role_status_transitions ?? {}).map(([from, targets]) => (
              <div key={from}>
                <dt>{t(`states.role.${from}`, { defaultValue: from })}</dt>
                <dd>{targets.length === 0 ? t('common.unavailable') : targets.map((target) => t(`states.role.${target}`, { defaultValue: target })).join(' / ')}</dd>
              </div>
            ))}
            <div>
              <dt>{t('admin.policy.reasonRequired')}</dt>
              <dd>{(policy.role_status_reason_required ?? []).map((status) => t(`states.role.${status}`, { defaultValue: status })).join(' / ')}</dd>
            </div>
            <div>
              <dt>{t('admin.policy.projectTargets')}</dt>
              <dd>{(policy.admin_project_target_statuses ?? []).map((status) => t(`states.project.${status}`, { defaultValue: status })).join(' / ')}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
};

const CmAdminGlossary: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <section className="cm-admin-section" aria-labelledby="cm-admin-glossary">
      <details className="cm-admin-glossary">
        <summary id="cm-admin-glossary">{t('admin.glossary.title')}</summary>
        <dl>
          {GLOSSARY_TERMS.map((term) => (
            <div key={term}>
              <dt>{t(`admin.glossary.${term}.term`)}</dt>
              <dd>{t(`admin.glossary.${term}.body`)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
};

export const CmAdminUsersPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [role, setRole] = useState(useCmAdminParam('role'));
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ search, role, status }), [search, role, status]);
  const list = useCmAdminList((query) => cmAdminApi.users(query), filters);

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.users" purposeKey="admin.purpose.users" onRefresh={() => void list.reload()} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchUsers" placeholderKey="admin.searchUsersPlaceholder" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterRole"
          value={role}
          onChange={setRole}
          options={CM_ADMIN_ROLE_TYPES}
          optionLabel={(option) => t(`roles.${option}`)}
          allKey="admin.allRoles"
        />
        <CmAdminSelect
          labelKey="admin.filterRoleStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_ROLE_STATUSES}
          optionLabel={(option) => t(`states.role.${option}`)}
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noUsers" onRetry={() => void list.reload()}>
        <CmAdminTable label={t('admin.nav.users')}>
          <thead>
            <tr>
              <th>{t('admin.columnUser')}</th>
              <th>{t('admin.userDetail.name')}</th>
              <th>{t('admin.columnEmail')}</th>
              <th>{t('admin.columnRoles')}</th>
              <th>{t('admin.columnCreated')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((user) => (
              <tr key={user.id}>
                <td className="cm-admin-nowrap">
                  <CmAdminUserLink user={{ id: user.id, username: user.username, name: user.name }} />
                  {user.is_admin && <span className="cm-admin-flag">{t('admin.adminFlag')}</span>}
                </td>
                <td>{user.name ?? t('common.unavailable')}</td>
                <td>{user.email ?? t('common.unavailable')}</td>
                <td>
                  {Object.keys(user.roles).length === 0 ? t('admin.noRole') : (
                    <span className="cm-admin-roles">
                      {Object.entries(user.roles).map(([roleType, roleStatus]) => (
                        <span key={roleType} className="cm-status" data-status={roleStatus}>
                          {t('admin.roleWithStatus', {
                            role: t(`roles.${roleType}`, { defaultValue: roleType }),
                            status: t(`states.role.${roleStatus}`, { defaultValue: roleStatus }),
                          })}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="cm-admin-nowrap"><CmAdminDate value={user.created_at} dateOnly /></td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
    </main>
  );
};

/** Authenticated private KYC document preview (blob -> object URL, revoked on change/unmount). */
export const CmAdminKycDocumentViewer: React.FC<{ kycId: number; documents: CmAdminKycRecord['documents'] }> = ({ kycId, documents }) => {
  const { t } = useTranslation('cm');
  const [active, setActive] = useState<CmAdminKycDocument | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = CM_ADMIN_KYC_DOCUMENTS.filter((type) => documents?.[type]);

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const open = async (type: CmAdminKycDocument): Promise<void> => {
    if (active === type) {
      setActive(null);
      setObjectUrl(null);
      return;
    }
    setActive(type);
    setObjectUrl(null);
    setError(null);
    setLoading(true);
    const response = await cmAdminApi.kycFile(kycId, type);
    setLoading(false);
    if (response.success && response.data) {
      setObjectUrl(URL.createObjectURL(response.data));
    } else {
      setError(cmErrorMessage(t, response, 'admin.kyc.documentFailed'));
    }
  };

  if (available.length === 0) {
    return <p className="cm-contract-note">{t('admin.kyc.noDocuments')}</p>;
  }

  return (
    <div className="cm-admin-documents">
      <div className="cm-table-actions" role="group" aria-label={t('admin.kyc.documents')}>
        {available.map((type) => (
          <button
            key={type}
            type="button"
            className={`cm-workspace-button ${active === type ? 'is-primary' : ''}`}
            aria-pressed={active === type}
            onClick={() => void open(type)}
          >
            <Eye aria-hidden="true" /> {t(`admin.kyc.document.${type}`)}
          </button>
        ))}
      </div>
      {active && (
        <figure className="cm-admin-document">
          {loading && <p className="cm-contract-note">{t('common.loading')}</p>}
          {error && <p className="cm-admin-notice" data-tone="error">{error}</p>}
          {objectUrl && <img src={objectUrl} alt={t(`admin.kyc.document.${active}`)} />}
          {objectUrl && <figcaption>{t('admin.kyc.privateNote')}</figcaption>}
        </figure>
      )}
    </div>
  );
};

export const CmAdminKycPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [status, setStatus] = useState(useCmAdminParam('status', 'pending'));
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [identityType, setIdentityType] = useState('');
  const filters = useMemo(() => ({ status, search, identity_type: identityType }), [status, search, identityType]);
  const list = useCmAdminList((query) => cmAdminApi.kyc(query), filters);
  const action = useCmAdminAction(list.reload);

  const userLabel = (item: CmAdminKycRecord): string => item.user?.username ?? t('admin.userNumber', { id: item.user_id });

  const approve = (item: CmAdminKycRecord): void => action.ask({
    title: t('admin.kyc.approveTitle', { name: item.real_name }),
    body: t('admin.kyc.approveBody', { user: userLabel(item) }),
    confirmLabel: t('admin.approve'),
    reason: 'optional',
    reasonLabel: t('admin.dialog.notes'),
    successKey: 'admin.kyc.approved',
    run: (notes) => cmAdminApi.approveKyc(item.id, notes),
  });

  const reject = (item: CmAdminKycRecord): void => action.ask({
    title: t('admin.kyc.rejectTitle', { name: item.real_name }),
    body: t('admin.kyc.rejectBody', { user: userLabel(item) }),
    confirmLabel: t('admin.reject'),
    tone: 'danger',
    reason: 'required',
    reasonLabel: t('admin.kyc.rejectReason'),
    successKey: 'admin.kyc.rejected',
    run: (notes) => cmAdminApi.rejectKyc(item.id, notes),
  });

  return (
    <main className="cm-workspace-page">
      <CmAdminPageHeader titleKey="admin.nav.kyc" purposeKey="admin.purpose.kyc" onRefresh={() => void list.reload()} />
      <CmAdminNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchKyc" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={CM_ADMIN_KYC_STATUSES}
          optionLabel={(option) => t(`states.kyc.${option}`)}
        />
        <CmAdminSelect
          labelKey="admin.kyc.identityType"
          value={identityType}
          onChange={setIdentityType}
          options={CM_ADMIN_IDENTITY_TYPES}
          optionLabel={(option) => t(`admin.kyc.identity.${option}`, { defaultValue: option })}
          allKey="admin.allTypes"
        />
      </CmAdminToolbar>
      <CmAdminListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noKyc" onRetry={() => void list.reload()}>
        <section className="cm-card-list">
          {list.items.map((item) => (
            <article key={item.id} className="cm-record-card cm-admin-record">
              <div className="cm-record-card__main">
                <div className="cm-admin-record__title">
                  <h2>{item.real_name}</h2>
                  <CmAdminStatus status={item.verification_status} group="states.kyc" />
                </div>
                <dl className="cm-admin-facts">
                  <div><dt>{t('admin.columnUser')}</dt><dd><CmAdminUserLink user={item.user} userId={item.user_id} /></dd></div>
                  <div><dt>{t('admin.kyc.identityType')}</dt><dd>{t(`admin.kyc.identity.${item.identity_type}`, { defaultValue: item.identity_type })}</dd></div>
                  <div><dt>{t('admin.kyc.submittedAt')}</dt><dd><CmAdminDate value={item.submitted_at} /></dd></div>
                  {item.verified_at && <div><dt>{t('admin.kyc.reviewedAt')}</dt><dd><CmAdminDate value={item.verified_at} /></dd></div>}
                </dl>
                {item.verification_notes && <p className="cm-admin-note">{t('admin.notesValue', { notes: item.verification_notes })}</p>}
                <CmAdminKycDocumentViewer kycId={item.id} documents={item.documents} />
              </div>
              {item.reviewable && (
                <div className="cm-record-card__actions">
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => approve(item)}>
                    <Check aria-hidden="true" /> {t('admin.approve')}
                  </button>
                  <button type="button" className="cm-workspace-button is-danger" onClick={() => reject(item)}>
                    <X aria-hidden="true" /> {t('admin.reject')}
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </CmAdminListState>
      <CmAdminPager page={list.page} totalPages={list.totalPages} total={list.total} onPage={list.setPage} />
      {action.dialog}
    </main>
  );
};
