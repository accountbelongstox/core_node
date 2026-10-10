import React, { useMemo, useState } from 'react';
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
  RotateCcw,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmFormatPercent } from '../components/workspace/cmWorkspaceFormat';
import { CmImage } from '../components/CmImage';
import { CM_ADMIN_ROUTE, cmRouteWithQuery } from '../components/public-home/cmPublicRoutes';
import { CmEmptyState, CmErrorState, CmListState, CmLoadingState, CmNotice } from '../components/workspace/CmStateViews';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { cmAdminApi } from './CmAdminApi';
import {
  CmAdminDate,
  CmAdminMoney,
  CmAdminSearch,
  CmAdminSelect,
  CmAdminTable,
  CmAdminToolbar,
  CmAdminUserLink,
  useCmAdminAction,
  useCmAdminFormat,
  useCmAdminList,
  useCmAdminParam,
} from './CmAdminShared';
import { useCmAdminActionBuilders } from './useCmAdminActions';
import { useCmAdminKycDocument, useCmAdminOverview } from './useCmAdminData';
import {
  type CmAdminKycRecord,
  type CmAdminPolicy,
} from './CmAdminTypes';

const GLOSSARY_TERMS = ['deposit', 'escrow', 'dispute', 'refund', 'withdrawal', 'kyc', 'roleStatus', 'reviewer', 'testimonial'] as const;

const QUEUE_ICONS: Record<string, LucideIcon> = {
  kyc: ShieldCheck,
  deposits: WalletCards,
  refunds: RotateCcw,
  withdrawals: Banknote,
  roles: UserCog,
  testimonials: MessageSquareQuote,
  contact: Inbox,
};

const TOTAL_ICONS: Record<string, LucideIcon> = {
  users: Users,
  roleHolders: UserCog,
  projects: BriefcaseBusiness,
  tasks: ListChecks,
  reviewersPassed: BadgeCheck,
};

export const CmAdminOverviewPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const { overview, policy, loading, error, load, openQueues, clearQueues, pendingTotal, totals, projectCounts, projectStatuses } = useCmAdminOverview();

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        variant="admin"
        titleKey="admin.nav.overview"
        purposeKey="admin.purpose.overview"
        onRefresh={() => void load()}
        aside={<CmImage name="admin-console" className="cm-admin-heading__image" />}
      />
      {loading ? (
        <CmLoadingState />
      ) : error || !overview ? (
        <CmErrorState message={error ?? t('admin.loadFailed')} onRetry={() => void load()} />
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
                  const Icon = QUEUE_ICONS[queue.id];
                  return (
                    <Link key={queue.id} to={queue.route} className="cm-admin-queue" data-active="true">
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
                  <Link key={queue.id} to={queue.route} className="cm-workspace-link">{t(`admin.overview.queue.${queue.id}.title`)}</Link>
                ))}
              </div>
            )}
          </section>

          <section className="cm-admin-section" aria-labelledby="cm-admin-totals">
            <h2 id="cm-admin-totals">{t('admin.overview.platformTitle')}</h2>
            <div className="cm-admin-counter-grid">
              {totals.map((card) => {
                const Icon = TOTAL_ICONS[card.key];
                const content = (
                  <>
                    <Icon aria-hidden="true" />
                    <strong>{format.number(card.value ?? 0)}</strong>
                    <span>{t(`admin.metrics.${card.key}`)}</span>
                  </>
                );
                return card.route
                  ? <Link key={card.key} to={card.route} className="cm-admin-counter">{content}</Link>
                  : <div key={card.key} className="cm-admin-counter">{content}</div>;
              })}
            </div>
          </section>

          <section className="cm-admin-section" aria-labelledby="cm-admin-projects">
            <h2 id="cm-admin-projects">{t('admin.overview.projectsByStatus')}</h2>
            {projectStatuses.length === 0 ? (
              <CmEmptyState title={t('admin.noProjectsAtAll')} compact />
            ) : (
              <div className="cm-admin-status-strip">
                {projectStatuses.map((status) => (
                  <Link key={status} to={cmRouteWithQuery(CM_ADMIN_ROUTE.projects, { status })} className="cm-admin-status-chip">
                    <CmStatusBadge status={status} prefix="states.project" />
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
  const thresholdRows = [
    ...Object.entries(policy.architect_thresholds ?? {}).map(([key, value]) => ({ key: `architect.${key}`, value })),
    ...Object.entries(policy.reviewer_thresholds ?? {}).map(([key, value]) => ({ key: `reviewer.${key}`, value })),
  ];

  return (
    <section className="cm-admin-section" aria-labelledby="cm-admin-policy">
      <div className="cm-admin-section__head">
        <h2 id="cm-admin-policy">{t('admin.policy.title')}</h2>
        <p>{t('admin.policy.editable')} <Link className="cm-workspace-link" to={CM_ADMIN_ROUTE.policy}>{t('admin.policy.editLink')}</Link></p>
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
              <dd>{cmFormatPercent(policy.platform_commission_rate, format.language)}</dd>
            </div>
            {policy.wallet_top_up && (
              <div>
                <dt>{t('admin.policy.walletTopUp')}</dt>
                <dd>
                  <CmAdminMoney amount={policy.wallet_top_up.min_amount} currency={policy.currency} />
                  {' – '}
                  <CmAdminMoney amount={policy.wallet_top_up.max_amount} currency={policy.currency} />
                </dd>
              </div>
            )}
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
  const { roles, states } = useCmBootstrap();
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [role, setRole] = useState(useCmAdminParam('role'));
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const filters = useMemo(() => ({ search, role, status }), [search, role, status]);
  const list = useCmAdminList((query) => cmAdminApi.users(query), filters);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.users" purposeKey="admin.purpose.users" onRefresh={() => void list.reload()} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchUsers" placeholderKey="admin.searchUsersPlaceholder" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterRole"
          value={role}
          onChange={setRole}
          options={roles}
          optionLabel={(option) => t(`roles.${option}`)}
          allKey="admin.allRoles"
        />
        <CmAdminSelect
          labelKey="admin.filterRoleStatus"
          value={status}
          onChange={setStatus}
          options={states('role')}
          optionLabel={(option) => t(`states.role.${option}`)}
        />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noUsers" onRetry={list.retryable ? () => void list.reload() : undefined}>
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </main>
  );
};

/** Authenticated private KYC document preview (blob -> object URL, revoked on change/unmount). */
export const CmAdminKycDocumentViewer: React.FC<{ kycId: number; documents: CmAdminKycRecord['documents'] }> = ({ kycId, documents }) => {
  const { t } = useTranslation('cm');
  const { available, active, objectUrl, loading, error, open } = useCmAdminKycDocument(kycId, documents);

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
          <CmNotice notice={error ? { tone: 'error', text: error } : null} />
          {objectUrl && <img src={objectUrl} alt={t(`admin.kyc.document.${active}`)} />}
          {objectUrl && <figcaption>{t('admin.kyc.privateNote')}</figcaption>}
        </figure>
      )}
    </div>
  );
};

export const CmAdminKycPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { states, policyList } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status', 'pending'));
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [identityType, setIdentityType] = useState('');
  const filters = useMemo(() => ({ status, search, identity_type: identityType }), [status, search, identityType]);
  const list = useCmAdminList((query) => cmAdminApi.kyc(query), filters);
  const action = useCmAdminAction(list.reload);

  const { approveKyc: approve, rejectKyc: reject } = useCmAdminActionBuilders(action.ask);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.kyc" purposeKey="admin.purpose.kyc" onRefresh={() => void list.reload()} />
      <CmNotice notice={action.notice} onDismiss={() => action.setNotice(null)} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchKyc" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('kyc')}
          optionLabel={(option) => t(`states.kyc.${option}`)}
        />
        <CmAdminSelect
          labelKey="admin.kyc.identityType"
          value={identityType}
          onChange={setIdentityType}
          options={policyList('identity_types')}
          optionLabel={(option) => t(`admin.kyc.identity.${option}`, { defaultValue: option })}
          allKey="admin.allTypes"
        />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noKyc" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <section className="cm-card-list">
          {list.items.map((item) => (
            <article key={item.id} className="cm-record-card cm-admin-record">
              <div className="cm-record-card__main">
                <div className="cm-admin-record__title">
                  <h2>{item.real_name}</h2>
                  <CmStatusBadge status={item.verification_status} prefix="states.kyc" />
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
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {action.dialog}
    </main>
  );
};
